import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(), getApiKeys: vi.fn(), getSessionUser: vi.fn(),
}));
vi.mock("@/lib/localDb", () => mocks);
vi.mock("@/lib/saas/config.js", () => ({ SAAS_MODE: true }));
vi.mock("@/lib/saas/session.js", () => mocks);
import { pingModelByKind } from "@/app/api/models/test/ping.js";
import { POST } from "@/app/api/models/test/route.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProviderConnections.mockResolvedValue([]);
  mocks.getSessionUser.mockResolvedValue({ id: "admin", role: "admin" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ models: [{ name: "qwen3.8:tuned" }] })));
});
afterEach(() => vi.unstubAllGlobals());

describe("Ollama local model validation", () => {
  it("uses local tags without a gateway API key", async () => {
    expect((await pingModelByKind("ollama-local/qwen3.8:tuned", "llm")).ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith("http://localhost:11434/api/tags", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mocks.getApiKeys).not.toHaveBeenCalled();
  });
  it("does not treat a tuned tag as the bare model", async () => {
    const result = await pingModelByKind("ollama-local/qwen3.8", "llm");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("qwen3.8:tuned");
  });
  it("accepts case-insensitive latest shorthand", async () => {
    fetch.mockResolvedValue(Response.json({ models: [{ name: "Qwen:latest" }] }));
    expect((await pingModelByKind("ollama-local/qwen", "llm")).ok).toBe(true);
  });
  it("uses an active configured host, never a disabled connection", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      { isActive: false, providerSpecificData: { baseUrl: "http://disabled:11434" } },
      { isActive: true, providerSpecificData: { baseUrl: "http://ollama:11434/" } },
    ]);
    expect((await pingModelByKind("ollama-local/qwen3.8:tuned", "llm")).ok).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe("http://ollama:11434/api/tags");
    mocks.getProviderConnections.mockResolvedValue([{ isActive: false }]);
    fetch.mockClear();
    expect((await pingModelByKind("ollama-local/qwen3.8:tuned", "llm")).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{ models: {} }, { models: [{ name: 42 }] }, null])("handles malformed tag responses: %j", async (body) => {
    fetch.mockResolvedValue(Response.json(body));
    expect((await pingModelByKind("ollama-local/qwen", "llm")).ok).toBe(false);
  });
  it("reports HTTP and connection errors", async () => {
    fetch.mockResolvedValue(new Response("failure", { status: 503 }));
    expect((await pingModelByKind("ollama-local/qwen", "llm")).status).toBe(503);
    fetch.mockRejectedValue(new Error("timeout"));
    expect((await pingModelByKind("ollama-local/qwen", "llm")).error).toContain("timeout");
  });
  it("denies tenants and anonymous requests before probing", async () => {
    for (const user of [null, { id: "tenant", role: "user" }]) {
      mocks.getSessionUser.mockResolvedValue(user);
      const response = await POST(new Request("http://localhost/api/models/test", {
        method: "POST", body: JSON.stringify({ model: "ollama-local/qwen" }),
      }));
      expect(response.status).toBe(user ? 403 : 401);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
