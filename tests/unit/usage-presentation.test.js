import { describe, expect, it } from "vitest";
import {
  buildUsageBreakdown,
  formatWibLogTimestamp,
  formatWibTimestamp,
  getProviderRequestCount,
} from "../../src/shared/utils/usagePresentation.js";

describe("usage presentation", () => {
  it("builds ranked request summaries from existing usage aggregates", () => {
    const breakdown = buildUsageBreakdown({
      byEndpoint: {
        "/v1/messages|claude|anthropic": { endpoint: "/v1/messages", requests: 7, provider: "Anthropic" },
        "/v1/chat/completions|gpt|openai": { endpoint: "/v1/chat/completions", requests: 3, provider: "OpenAI" },
      },
      byApiKey: {
        "sk-local***|claude|anthropic": { keyName: "Local CLI", apiKeyMasked: "sk-local***", requests: 7 },
      },
      byProvider: {
        anthropic: { requests: 7 },
        openai: { requests: 3 },
      },
      byModel: {
        "claude (anthropic)": { rawModel: "claude", provider: "Anthropic", requests: 7 },
      },
      byAccount: {
        "claude (anthropic - team)": { accountName: "team", provider: "Anthropic", rawModel: "claude", requests: 7 },
      },
      bySource: {
        "203.0.113.9": { requests: 7 },
      },
    });

    expect(breakdown.endpoints[0]).toMatchObject({ label: "/v1/messages", requests: 7, detail: "Anthropic" });
    expect(breakdown.providers[0]).toMatchObject({ label: "anthropic", requests: 7 });
    expect(breakdown.apiKeys[0]).toMatchObject({ label: "Local CLI", requests: 7 });
    expect(breakdown.models[0]).toMatchObject({ label: "claude", requests: 7, detail: "Anthropic" });
    expect(breakdown.accounts[0]).toMatchObject({ label: "team", requests: 7, detail: "claude · Anthropic" });
    expect(breakdown.sources[0]).toMatchObject({ label: "203.0.113.9", requests: 7 });
  });

  it("matches provider request counts without case-sensitive IDs", () => {
    expect(getProviderRequestCount({ Anthropic: { requests: 7 } }, "anthropic")).toBe(7);
    expect(getProviderRequestCount({ openai: { requests: 3 } }, "OPENAI")).toBe(3);
    expect(getProviderRequestCount({}, "gemini")).toBe(0);
  });

  it("formats a timestamp in WIB without changing the stored instant", () => {
    const stored = "2026-09-17T00:00:00.000Z";

    expect(formatWibTimestamp(stored)).toBe("17/09/2026, 07.00.00");
    expect(formatWibLogTimestamp(stored)).toBe("17-09-2026 07:00:00");
  });
});
