import { describe, expect, it } from "vitest";

import { FORMATS } from "../../open-sse/translator/formats.js";
import { createSSETransformStreamWithLogger } from "../../open-sse/utils/stream.js";

async function runWithCallback(sourceFormat, targetFormat, input, opts = {}) {
  const encoder = new TextEncoder();
  let completionData = null;

  const onStreamComplete = (contentObj, usage, ttftAt) => {
    completionData = { contentObj, usage, ttftAt };
  };

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(input));
      controller.close();
    },
  });

  const output = stream.pipeThrough(
    createSSETransformStreamWithLogger(
      sourceFormat,
      targetFormat,
      opts.provider || "openai",
      null, null, null, null, null,
      onStreamComplete,
    ),
  );

  const reader = output.getReader();
  const decoder = new TextDecoder();
  let clientText = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    clientText += decoder.decode(value, { stream: true });
  }
  clientText += decoder.decode();

  return { completionData, clientText };
}

const openaiChunk = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
const openaiDone = "data: [DONE]\n\n";

describe("stream completion captures full provider and client bodies", () => {
  it("accumulates the raw upstream SSE text and the translated client SSE text", async () => {
    const providerSSE = openaiChunk("hello ") + openaiChunk("world") + openaiDone;
    const { completionData } = await runWithCallback(FORMATS.OPENAI, FORMATS.OPENAI, providerSSE);
    expect(completionData).not.toBeNull();
    expect(completionData.contentObj.providerResponse).toBe(providerSSE);
    expect(completionData.contentObj.response).toContain("hello ");
    expect(completionData.contentObj.response).toContain("world");
    expect(completionData.contentObj.content).toBe("hello world");
  });

  it("includes the decoder tail in the raw provider body (flush remainder)", async () => {
    const full = openaiChunk("hi") + openaiDone;
    const { completionData } = await runWithCallback(FORMATS.OPENAI, FORMATS.OPENAI, full);
    expect(completionData.contentObj.providerResponse).toBe(full);
    expect(completionData.contentObj.content).toBe("hi");
  });
});
