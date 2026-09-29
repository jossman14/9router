import { describe, it, expect } from "vitest";
import { expectedVendor, detectVendor, judgeMask } from "@/lib/modelMask.js";

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
});
