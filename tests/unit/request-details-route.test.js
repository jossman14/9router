import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestDetails: vi.fn(),
  getConsistentMachineId: vi.fn(),
  getSettings: vi.fn(),
  validateApiKey: vi.fn(),
  verifyDashboardAuthToken: vi.fn(),
  getDashboardAuthSession: vi.fn(),
}));

vi.mock("@/lib/usageDb", () => ({ getRequestDetails: mocks.getRequestDetails }));
vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
  validateApiKey: mocks.validateApiKey,
}));
vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: mocks.getConsistentMachineId,
}));
vi.mock("@/lib/auth/dashboardSession", () => ({
  verifyDashboardAuthToken: mocks.verifyDashboardAuthToken,
  getDashboardAuthSession: mocks.getDashboardAuthSession,
}));

const { GET } = await import("../../src/app/api/usage/request-details/route.js");

const PEER_TOKEN = "route-peer-proof";
const privateDetail = {
  id: "detail-1",
  source: "203.0.113.9",
  clientIp: "203.0.113.9",
  method: "POST",
  userAgent: "client",
  clientHeaders: { "x-request-id": "client-1" },
  providerHeaders: { "content-type": "application/json" },
  request: { messages: [{ role: "user", content: "secret" }] },
  providerRequest: { messages: [{ role: "user", content: "secret" }] },
  providerResponse: { choices: [{ message: { content: "secret" } }] },
  response: { choices: [{ message: { content: "secret" } }] },
};

function request(headers = {}) {
  return new Request("http://router.example.com/api/usage/request-details?page=1&pageSize=20", { headers });
}

async function detail(headers) {
  return (await (await GET(request(headers))).json()).details[0];
}

function expectPrivateFieldsRedacted(value) {
  for (const key of ["clientHeaders", "providerHeaders", "request", "providerRequest", "providerResponse", "response"]) {
    expect(value[key]).toEqual({ redacted: true });
  }
}

describe("request-details payload authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NINEROUTER_PEER_TOKEN = PEER_TOKEN;
    mocks.getConsistentMachineId.mockResolvedValue("valid-cli-token");
    mocks.getSettings.mockResolvedValue({ requireLogin: true });
    mocks.getRequestDetails.mockResolvedValue({ details: [privateDetail], totalItems: 1, totalPages: 1 });
  });

  it("returns complete payloads and headers to a trusted local caller", async () => {
    const value = await detail({ "x-9r-peer-token": PEER_TOKEN, "x-9r-real-ip": "127.0.0.1" });
    expect(value.request).toEqual(privateDetail.request);
    expect(value.clientHeaders).toEqual(privateDetail.clientHeaders);
  });

  it("returns complete payloads and headers with a valid CLI token", async () => {
    const value = await detail({ "x-9r-cli-token": "valid-cli-token" });
    expect(value.providerRequest).toEqual(privateDetail.providerRequest);
    expect(value.providerHeaders).toEqual(privateDetail.providerHeaders);
  });

  it("keeps metadata but redacts private fields for a dashboard JWT alone", async () => {
    mocks.verifyDashboardAuthToken.mockResolvedValue(true);
    const value = await detail({ cookie: "auth_token=valid-dashboard-jwt" });
    expect(value).toMatchObject({ source: privateDetail.source, method: "POST", userAgent: "client" });
    expectPrivateFieldsRedacted(value);
  });

  it.each([undefined, "wrong-cli-token"])("redacts private fields when CLI token is %s", async (token) => {
    const value = await detail(token ? { "x-9r-cli-token": token } : {});
    expectPrivateFieldsRedacted(value);
  });
});
