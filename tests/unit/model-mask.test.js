import { describe, it, expect } from "vitest";
import { expectedVendor, detectVendor, judgeMask, clusterBackends, claimedModel, modelClaims, claimedCutoff, expectedCutoff } from "@/lib/modelMask.js";

const probe = (over = {}) => ({ ok: true, requested: "cc/claude-sonnet-4-5", returnedModel: "claude-sonnet-4-5", promptTokens: 120, reply: '{"vendor":"Anthropic","model":"Claude"}', ...over });

describe("model mask detection", () => {
  it("maps model ids to vendors, ignoring provider prefix", () => {
    expect(expectedVendor("cc/claude-opus-4-1")).toBe("anthropic");
    expect(expectedVendor("gh/gpt-5")).toBe("openai");
    expect(expectedVendor("gemini-2.5-pro")).toBe("google");
    expect(expectedVendor("srb/auto")).toBeNull();
  });

  it("detects the vendor a reply claims", () => {
    expect(detectVendor("I am Claude, made by Anthropic")).toBe("anthropic");
    expect(detectVendor("我是通义千问 Qwen")).toBe("alibaba");
    expect(detectVendor("no idea")).toBeNull();
    expect(detectVendor('{"vendor":"Shanghai Artificial Intelligence Laboratory","model":"Atria"}')).toBe("shanghai-ai-lab");
  });

  it("passes a consistent genuine model", () => {
    expect(judgeMask(probe()).verdict).toBe("genuine");
  });

  it("flags masked when identity and returned model both disagree", () => {
    const r = judgeMask(probe({ returnedModel: "deepseek-chat", reply: "I am DeepSeek-V3" }));
    expect(r.verdict).toBe("masked");
  });

  it("flags suspicious on a single disagreeing signal", () => {
    expect(judgeMask(probe({ reply: "I am ChatGPT by OpenAI" })).verdict).toBe("suspicious");
  });

  it("flags masked on a tokenizer mismatch with the reference", () => {
    const r = judgeMask(probe(), probe({ promptTokens: 98 }));
    expect(r.verdict).toBe("masked");
    expect(r.checks.find((c) => c.id === "tokenizer").pass).toBe(false);
  });

  it("verifies a router alias against the model it says it served", () => {
    const auto = { requested: "srb/auto", returnedModel: "claude-sonnet-4-5" };
    expect(judgeMask(probe({ ...auto, reply: "I am Claude" })).verdict).toBe("genuine");
    expect(judgeMask(probe({ ...auto, reply: "I am Qwen" })).verdict).toBe("suspicious");
  });

  it("names a hidden upstream prompt when the target uses far more tokens", () => {
    const r = judgeMask(probe({ promptTokens: 156 }), probe({ promptTokens: 43 }));
    expect(r.checks.find((c) => c.id === "tokenizer").detail).toContain("~113 extra tokens");
  });

  it("returns unknown when nothing can be checked", () => {
    expect(judgeMask(probe({ requested: "srb/auto", returnedModel: "auto", reply: "hello" })).verdict).toBe("unknown");
  });

  it("splits a pooled alias into backends by claimed vendor and hidden-prompt size", () => {
    const s = (promptTokens, reply) => probe({ requested: "srb/auto", returnedModel: "auto", promptTokens, reply });
    const samples = [
      s(156, '{"vendor":"OpenAI"}'), s(156, '{"vendor":"OpenAI"}'),
      s(161, '{"vendor":"Shanghai Artificial Intelligence Laboratory"}'),
      s(16091, '{"vendor":"Anthropic","model":"Claude Sonnet 5"}'), s(16091, '{"vendor":"Anthropic","model":"Claude Sonnet 5"}'),
      s(161, ""), { ok: false, error: "timeout" },
    ];
    const backends = clusterBackends(samples);
    expect(backends.map((b) => [b.vendor, b.count])).toEqual([["openai", 2], ["anthropic", 2], ["shanghai-ai-lab", 1]]);
    expect(backends[1].promptTokens).toEqual({ min: 16091, max: 16091 });
    expect(backends[1].models).toEqual({ "Claude Sonnet 5": 2 });
    expect(backends[0].models).toEqual({});
    expect(modelClaims(backends[1])).toBe("Claude Sonnet 5 ×2");
    expect(modelClaims(backends[0])).toBe("undisclosed ×2");

    const r = judgeMask(samples[0], null, samples);
    expect(r.verdict).toBe("masked");
    expect(r.checks.find((c) => c.id === "consistency").pass).toBe(false);
  });

  it("reads the claimed model name and ignores refusals", () => {
    expect(claimedModel('{"vendor":"OpenAI","model":"GPT-5"}')).toBe("GPT-5");
    expect(claimedModel('```json\n{"vendor": "Shanghai AI Lab", "model": "Atria"}\n```')).toBe("Atria");
    for (const r of ['{"model":"unknown"}', '{"model":"not disclosed"}', '{"model":"not specified"}', '{"model":"N/A"}', "I am an assistant."]) {
      expect(claimedModel(r)).toBeNull();
    }
  });

  it("treats steady samples from one backend as consistent", () => {
    const samples = [probe(), probe(), probe({ promptTokens: 121 })];
    expect(clusterBackends(samples)).toHaveLength(1);
    expect(judgeMask(samples[0], null, samples).verdict).toBe("genuine");
  });

  it("reads a claimed knowledge cutoff from JSON or prose", () => {
    expect(claimedCutoff('{"vendor":"OpenAI","model":"gpt-5","cutoff":"2024-09"}')).toBe("2024-09");
    expect(claimedCutoff('{"cutoff":"October 2023"}')).toBe("2023-10");
    expect(claimedCutoff("My training data goes up to April 2024.")).toBe("2024-04");
    expect(claimedCutoff("Data saya sampai Okt 2024")).toBe("2024-10");
    expect(claimedCutoff('{"cutoff":"2023"}')).toBe("2023");
    expect(claimedCutoff('{"cutoff":"unknown"}')).toBeNull();
    expect(expectedCutoff("cc/claude-sonnet-4-5")).toBe("2025-01");
    expect(expectedCutoff("srb/auto")).toBeNull();
  });

  it("flags a newer model name answering with a much older cutoff", () => {
    const old = judgeMask(probe({ reply: '{"vendor":"Anthropic","model":"Claude","cutoff":"2023-04"}' }));
    expect(old.checks.find((c) => c.id === "cutoff").pass).toBe(false);
    expect(old.verdict).toBe("suspicious");

    // Under-reporting by a few months is normal and must not trip it.
    const close = judgeMask(probe({ reply: '{"vendor":"Anthropic","model":"Claude","cutoff":"2024-06"}' }));
    expect(close.checks.find((c) => c.id === "cutoff").pass).toBe(true);
    expect(close.verdict).toBe("genuine");

    // Combined with a wrong vendor it is masking, not a fluke.
    const fake = judgeMask(probe({ reply: '{"vendor":"OpenAI","model":"gpt-4o-mini","cutoff":"2023-10"}' }));
    expect(fake.verdict).toBe("masked");
  });
});
