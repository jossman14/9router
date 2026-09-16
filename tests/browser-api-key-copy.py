"""Run after npm run build: python tests/browser-api-key-copy.py.
Uses a temporary SQLite database and local test server; never touches live keys.
Requires the already-installed Python Playwright and Chromium.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
PASSWORD = "browser-test-password"

with tempfile.TemporaryDirectory(prefix="9r-key-browser-") as temp:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    env = dict(os.environ, DATA_DIR=temp, SAAS_MODE="true", PORT=str(port),
               HOSTNAME="127.0.0.1", JWT_SECRET="browser-test-jwt-secret-at-least-32-chars",
               API_KEY_SECRET="browser-test-key-secret-at-least-32-chars",
               INITIAL_PASSWORD=PASSWORD, AUTH_COOKIE_SECURE="false",
               ADMIN_EMAIL="admin@example.test")
    seed = """
import { createUser } from './src/lib/db/repos/usersRepo.js';
import { createPackage } from './src/lib/db/repos/packagesRepo.js';
import { ensureSubscription } from './src/lib/db/repos/subscriptionsRepo.js';
import { getAdapter } from './src/lib/db/driver.js';
await createPackage({name:'Browser test',tokenQuota:10000,maxKeys:4});
for (const email of ['admin@example.test','tenant@example.test']) {
  const u = await createUser({email,password:process.env.INITIAL_PASSWORD});
  await ensureSubscription(u.id);
  (await getAdapter()).run(`INSERT INTO apiKeys(id,key,name,userId,keyPrefix,isActive,createdAt)
    VALUES(?,?,?,?,?,1,?)`, [u.id+'-old',u.id+'-hash','Older key',u.id,'sk9r_old',new Date().toISOString()]);
}
process.exit(0);
"""
    subprocess.run(["node", "--input-type=module", "-e", seed], cwd=ROOT, env=env, check=True,
                   stdout=subprocess.DEVNULL)
    log = open(Path(temp) / "server.log", "w+")
    server = None

    def start():
        proc = subprocess.Popen(["node", "custom-server.js", "--hostname", "127.0.0.1", "--port", str(port)],
                                cwd=ROOT, env=env, stdout=log, stderr=log)
        for _ in range(100):
            if proc.poll() is not None:
                raise RuntimeError("Isolated server exited; check production build")
            try:
                with urllib.request.urlopen(base + "/api/health", timeout=1):
                    return proc
            except OSError:
                time.sleep(0.2)
        proc.terminate()
        raise RuntimeError("Isolated server did not become ready")

    def login(context, email):
        res = context.request.post(base + "/api/auth/login", data={"email": email, "password": PASSWORD})
        assert res.status == 200, f"Test login failed: {res.status}"

    try:
        server = start()
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(permissions=["clipboard-read", "clipboard-write"])
            login(context, "admin@example.test")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base + "/dashboard/endpoint")
            expect(page.get_by_role("button", name="Copy key Older key", exact=True)).to_be_disabled()
            page.get_by_role("button", name="Create Key").click()
            page.get_by_placeholder("Production Key").fill("Browser key")
            page.get_by_role("button", name="Create", exact=True).click()
            secret_input = page.get_by_role("textbox", name="API key value", exact=True)
            expect(secret_input).to_be_visible()
            secret = secret_input.input_value()
            assert secret.startswith("sk9r_")
            assert "only time you will see this key" not in page.inner_text("body")
            page.get_by_role("button", name="Done", exact=True).click()
            page.reload()
            copy = page.get_by_role("button", name="Copy key Browser key", exact=True)
            expect(copy).to_be_enabled()
            copy.click()
            expect(copy).to_contain_text("Copied!")
            assert page.evaluate("navigator.clipboard.readText()") == secret
            rows = context.request.get(base + "/api/keys").json()["keys"]
            row = next(row for row in rows if row["name"] == "Browser key")
            assert row["key"] is None and row["hasEncrypted"]
            assert "keyEncrypted" not in row
            url = base + f"/api/keys/{row['id']}/reveal"
            reveal = context.request.post(url, headers={"Origin": base})
            assert reveal.status == 200 and reveal.json()["key"] == secret
            assert reveal.headers["cache-control"] == "no-store"
            assert context.request.post(url, headers={"Origin": "https://other.example.test"}).status == 403

            # Denied clipboard access must show the real key, not false success.
            page.reload()
            expect(copy).to_be_enabled()
            page.evaluate("() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; }")
            copy.click()
            expect(secret_input).to_be_visible()
            assert secret_input.input_value() == secret
            expect(copy).not_to_contain_text("Copied!")
            page.get_by_role("dialog").get_by_role("button", name="Copy").click()
            expect(page.get_by_role("dialog").get_by_role("alert")).to_contain_text("copy it manually")
            page.get_by_role("button", name="Done", exact=True).click()

            # Timer must expire even when the parent re-renders. Check phone layout too.
            page.clock.install()
            page.get_by_role("button", name="Show key Browser key", exact=True).click()
            expect(secret_input).to_be_visible()
            for width in [320, 768, 1440]:
                page.set_viewport_size({"width": width, "height": 900})
                box = page.get_by_role("dialog").bounding_box()
                assert box and box["x"] >= 0 and box["x"] + box["width"] <= width
            page.clock.fast_forward(61_000)
            expect(secret_input).to_have_count(0)
            assert not errors, errors
            context.close()

            # A real process restart must not lose the encrypted key.
            server.terminate()
            server.wait(timeout=20)
            server = start()
            context = browser.new_context()
            login(context, "admin@example.test")
            response = context.request.post(url, headers={"Origin": base})
            assert response.status == 200 and response.json()["key"] == secret
            tenant = browser.new_context()
            login(tenant, "tenant@example.test")
            assert tenant.request.post(url, headers={"Origin": base}).status == 404
            anonymous = browser.new_context()
            assert anonymous.request.post(url, headers={"Origin": base}).status == 401
            anonymous.close()
            tenant.close()
            context.close()
            browser.close()
        print("PASS: create, reload, copy, clipboard fallback, expiry, responsive dialog, restart, owner-only reveal")
    finally:
        if server is not None and server.poll() is None:
            server.terminate()
            server.wait(timeout=20)
        log.close()
