import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  revealApiKey: vi.fn(),
  createApiKey: vi.fn(),
  getApiKeys: vi.fn(),
  getConsistentMachineId: vi.fn(),
  config: { SAAS_MODE: true },
}));
vi.mock("@/lib/saas/session.js", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/localDb", () => mocks);
vi.mock("@/lib/db/index.js", () => mocks);
vi.mock("@/lib/saas/config.js", () => mocks.config);
vi.mock("@/shared/utils/machineId", () => ({ getConsistentMachineId: mocks.getConsistentMachineId }));

let reveal, keysRoute;
const ORIGIN = "https://router.example.test";
const PLAINTEXT = "sk9r_route-test-credential";

function request(headers = {}, url = `${ORIGIN}/api/keys/key-1/reveal`) {
  const allHeaders = new Headers({ origin: ORIGIN, host: "router.example.test", ...headers });
  for (const [key, value] of Object.entries(headers)) {
    if (value === null) allHeaders.delete(key);
  }
  return new Request(url, { method: "POST", headers: allHeaders });
}

function callReveal(req = request(), id = "key-1") {
  return reveal(req, { params: Promise.resolve({ id }) });
}

async function expectResponse(response, status, body) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual(body);
}

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.config.SAAS_MODE = true;
  mocks.getSessionUser.mockResolvedValue({ id: "owner" });
  mocks.revealApiKey.mockResolvedValue(PLAINTEXT);
  mocks.createApiKey.mockResolvedValue({ key: PLAINTEXT, id: "key-1", name: "app", keyPrefix: "sk9r_route-t" });
  mocks.getApiKeys.mockResolvedValue([]);
  ({ POST: reveal } = await import("@/app/api/keys/[id]/reveal/route.js"));
  keysRoute = await import("@/app/api/keys/route.js");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("owned POST key reveal", () => {
  it("returns plaintext only through the authenticated owner lookup", async () => {
    await expectResponse(await callReveal(), 200, { key: PLAINTEXT });
    expect(mocks.revealApiKey).toHaveBeenCalledWith("key-1", "owner");
  });

  it("returns 401 without an owner session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expectResponse(await callReveal(), 401, { error: "Unauthorized" });
    expect(mocks.revealApiKey).not.toHaveBeenCalled();
  });

  it("returns the same 404 for foreign, missing and undecryptable keys", async () => {
    mocks.revealApiKey.mockResolvedValue(null);
    for (const id of ["foreign", "missing", "undecryptable", undefined]) {
      const response = await reveal(request(), { params: Promise.resolve({ id }) });
      await expectResponse(response, 404, { error: "Key not found" });
    }
    expect(mocks.revealApiKey).toHaveBeenCalledWith("foreign", "owner");
  });

  it.each([
    { origin: "https://attacker.test" },
    { origin: "https://sub.router.example.test" },
    { origin: "https://router.example.test:8443" },
    { origin: "null" },
    { origin: "not-a-url" },
    { origin: null },
    { "sec-fetch-site": "cross-site" },
    { origin: "https://attacker.test", "x-forwarded-host": "attacker.test" },
  ])("denies non-same-origin reveal requests (%j)", async (headers) => {
    const response = await callReveal(request(headers));
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.revealApiKey).not.toHaveBeenCalled();
  });

  it("accepts a same-host browser request behind a TLS-terminating proxy", async () => {
    const req = request({ "sec-fetch-site": "same-origin" }, "http://127.0.0.1:20128/api/keys/key-1/reveal");
    await expectResponse(await callReveal(req), 200, { key: PLAINTEXT });
  });

  it("uses the URL host when the request has no Host header", async () => {
    await expectResponse(await callReveal(request({ host: null })), 200, { key: PLAINTEXT });
  });

  it("limits all key ids together per user, resets after a minute, and isolates users", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 10; i++) {
      expect((await callReveal(request(), `key-${i}`)).status).toBe(200);
    }
    const limited = await callReveal(request(), "another-key");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mocks.revealApiKey).toHaveBeenCalledTimes(10);
    mocks.getSessionUser.mockResolvedValue({ id: "other-owner" });
    expect((await callReveal()).status).toBe(200);
    mocks.getSessionUser.mockResolvedValue({ id: "owner" });
    vi.setSystemTime(Date.now() + 60_001);
    expect((await callReveal()).status).toBe(200);
  });

  it.each(["getSessionUser", "revealApiKey"])("returns a non-cacheable generic 500 when %s fails without logging secrets", async (method) => {
    mocks[method].mockRejectedValue(new Error(`database failure ${PLAINTEXT}`));
    await expectResponse(await callReveal(), 500, { error: "Failed to reveal key" });
    expect(JSON.stringify([...console.log.mock.calls, ...console.error.mock.calls], (_, value) =>
      value instanceof Error ? value.message : value)).not.toContain(PLAINTEXT);
  });
});

describe("key creation/list cache and error handling", () => {
  it("never caches successful creation or key listing", async () => {
    const response = await keysRoute.POST(new Request(`${ORIGIN}/api/keys`, {
      method: "POST", body: JSON.stringify({ name: "app" }),
    }));
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expectResponse(await keysRoute.GET(), 200, { keys: [] });
  });

  it("never caches validation, unauthorized or quota-limit errors", async () => {
    const create = (name) => keysRoute.POST(new Request(`${ORIGIN}/api/keys`, {
      method: "POST", body: JSON.stringify({ name }),
    }));
    await expectResponse(await create(""), 400, { error: "Name is required" });
    mocks.getSessionUser.mockResolvedValue(null);
    await expectResponse(await create("app"), 401, { error: "Unauthorized" });
    await expectResponse(await keysRoute.GET(), 401, { error: "Unauthorized" });
    mocks.getSessionUser.mockResolvedValue({ id: "owner" });
    mocks.createApiKey.mockRejectedValue(Object.assign(new Error("Key limit"), { code: "KEY_LIMIT" }));
    await expectResponse(await create("app"), 403, { error: "Key limit" });
  });

  it("never caches or leaks internal creation/list errors", async () => {
    const secretError = new Error(`failure ${PLAINTEXT}`);
    mocks.createApiKey.mockRejectedValue(secretError);
    mocks.getApiKeys.mockRejectedValue(secretError);
    const response = await keysRoute.POST(new Request(`${ORIGIN}/api/keys`, {
      method: "POST", body: JSON.stringify({ name: "app" }),
    }));
    await expectResponse(response, 500, { error: "Failed to create key" });
    await expectResponse(await keysRoute.GET(), 500, { error: "Failed to fetch keys" });
    expect(JSON.stringify([...console.log.mock.calls, ...console.error.mock.calls], (_, value) =>
      value instanceof Error ? value.message : value)).not.toContain(PLAINTEXT);
  });
});
