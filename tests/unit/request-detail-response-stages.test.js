import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/usageDb.js", () => ({
  appendRequestLog: vi.fn(async () => {}),
  saveRequestDetail: vi.fn(async () => {}),
  saveRequestUsage: vi.fn(async () => {}),
}));

const { saveRequestDetail } = await import("@/lib/usageDb.js");
const { handleForcedSSEToJson } = await import("../../open-sse/handlers/chatCore/sseToJsonHandler.js");
const { handleNonStreamingResponse } = await import("../../open-sse/handlers/chatCore/nonStreamingHandler.js");

function context(raw, overrides = {}) {
  return {
    providerResponse: new Response(raw, { headers: { "content-type": "text/event-stream" } }),
    provider: "codex", model: "test-model", sourceFormat: "openai", targetFormat: "openai-responses",
    body: { messages: [] }, stream: false, requestStartTime: Date.now(),
    clientRawRequest: { body: { input: "hello" }, headers: {} },
    trackDone() {}, appendLog() {}, reqLogger: { logProviderResponse() {}, logConvertedResponse() {} },
    ...overrides,
  };
}

describe("exact request detail response stages", () => {
  it.each(["openai", "openai-responses", "gemini"])("saves raw Responses SSE and the returned %s body", async (sourceFormat) => {
    saveRequestDetail.mockClear();
    const item = { type: "function_call", call_id: "call_1", name: "lookup", arguments: '{"q":"hello"}' };
    const raw = `event: response.output_item.done\ndata: ${JSON.stringify({ output_index: 0, item })}\n\nevent: response.completed\ndata: ${JSON.stringify({ response: { id: "resp_1", output: [item], usage: { input_tokens: 5, output_tokens: 2 } } })}\n\n`;
    const result = await handleForcedSSEToJson(context(raw, { sourceFormat }));
    expect(result.success).toBe(true);
    const returned = await result.response.json();
    expect(saveRequestDetail).toHaveBeenCalledTimes(1);
    const saved = saveRequestDetail.mock.calls[0][0];
    expect(saved.providerResponse).toBe(raw);
    expect(saved.response).toEqual(returned);
    if (sourceFormat === "openai") expect(returned.choices[0].message.tool_calls[0]).toEqual({ id: "call_1", type: "function", function: { name: "lookup", arguments: '{"q":"hello"}' } });
  });

  it("preserves the original Cline envelope before client response normalization", async () => {
    saveRequestDetail.mockClear();
    const raw = { success: true, data: { choices: [{ message: { content: "hello" }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 2 } } };
    const result = await handleNonStreamingResponse(context(JSON.stringify(raw), {
      provider: "cline", targetFormat: "openai",
      providerResponse: new Response(JSON.stringify(raw), { headers: { "content-type": "application/json" } }),
    }));
    expect(result.success).toBe(true);
    const returned = await result.response.json();
    expect(saveRequestDetail.mock.calls[0][0].providerResponse).toEqual(raw);
    expect(saveRequestDetail.mock.calls[0][0].response).toEqual(returned);
  });
});
