import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildProviderHeaders,
  buildRequestDetail,
  clientSource,
} from "../../open-sse/handlers/chatCore/requestDetail.js";

const originalPeerToken = process.env.NINEROUTER_PEER_TOKEN;

beforeEach(() => {
  process.env.NINEROUTER_PEER_TOKEN = "peer-proof";
});

afterAll(() => {
  if (originalPeerToken === undefined) delete process.env.NINEROUTER_PEER_TOKEN;
  else process.env.NINEROUTER_PEER_TOKEN = originalPeerToken;
});

describe("request detail origin metadata", () => {
  it("uses only a peer-proven x-9r-real-ip and ignores forwarded addresses", () => {
    const request = {
      headers: {
        "x-9r-peer-token": "peer-proof",
        "x-9r-real-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.4",
      },
    };

    expect(clientSource(request)).toBe("203.0.113.9");
    expect(buildRequestDetail({ clientRawRequest: request }).clientIp).toBe("203.0.113.9");
  });

  it("falls back to local when x-9r-real-ip lacks the custom-server proof", () => {
    const request = {
      headers: {
        "x-9r-real-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.4",
      },
    };

    expect(clientSource(request)).toBe("local");
    expect(buildRequestDetail({ clientRawRequest: request }).clientIp).toBeNull();
  });

  it("keeps provider request and response headers separate", () => {
    const responseHeaders = new Headers({
      "content-type": "application/json",
      "set-cookie": "session=secret",
    });

    expect(buildProviderHeaders(
      { authorization: "Bearer provider-secret", "x-request-id": "r1" },
      responseHeaders,
    )).toEqual({
      request: { authorization: "Bearer provider-secret", "x-request-id": "r1" },
      response: { "content-type": "application/json", "set-cookie": "session=secret" },
    });
  });

  it("computes UTF-8 byte sizes for all four payload stages", () => {
    const request = { text: "é" };
    const providerRequest = { input: "مرحبا" };
    const providerResponse = { output: "你好" };
    const response = { content: "selesai" };

    const detail = buildRequestDetail({ request, providerRequest, providerResponse, response });

    expect(detail.payloadSizes).toEqual({
      request: Buffer.byteLength(JSON.stringify(request)),
      providerRequest: Buffer.byteLength(JSON.stringify(providerRequest)),
      providerResponse: Buffer.byteLength(JSON.stringify(providerResponse)),
      response: Buffer.byteLength(JSON.stringify(response)),
    });
  });

  it("prefers the raw client body over the reduced request config", () => {
    const rawBody = { model: "m", messages: [], custom_field: "kept" };
    const detail = buildRequestDetail({
      clientRawRequest: { body: rawBody, headers: {} },
      request: { model: "m", messages: [] },
    });

    expect(detail.request).toEqual(rawBody);
  });
});
