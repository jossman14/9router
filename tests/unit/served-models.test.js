import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { servedModelOf } from "../../open-sse/handlers/chatCore/requestDetail.js";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-served-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("served model tracking", () => {
  it("reads the served model from JSON bodies and raw SSE", () => {
    expect(servedModelOf({ model: "claude-sonnet-4-5" })).toBe("claude-sonnet-4-5");
    expect(servedModelOf({ modelVersion: "gemini-2.5-pro" })).toBe("gemini-2.5-pro");
    expect(servedModelOf('event: message_start\ndata: {"type":"message_start","message":{"id":"x","model":"glm-4.6"}}')).toBe("glm-4.6");
    expect(servedModelOf("data: [DONE]")).toBeNull();
  });

  it("groups requested vs served model per provider", async () => {
    const base = { provider: "srb", model: "auto", tokens: { prompt_tokens: 10, completion_tokens: 5 } };
    await db.saveRequestUsage({ ...base, timestamp: new Date(Date.now() - 3000).toISOString(), meta: { source: "local", servedModel: "glm-4.6" } });
    await db.saveRequestUsage({ ...base, timestamp: new Date(Date.now() - 2000).toISOString(), meta: { source: "local", servedModel: "glm-4.6" } });
    await db.saveRequestUsage({ ...base, timestamp: new Date(Date.now() - 1000).toISOString(), meta: { source: "local", servedModel: "qwen3-coder" } });
    await db.saveRequestUsage({ ...base, model: "old", timestamp: new Date().toISOString() });

    const rows = await db.getServedModels("today");
    expect(rows).toEqual([
      expect.objectContaining({ provider: "srb", model: "auto", servedModel: "glm-4.6", requests: 2, totalTokens: 30 }),
      expect.objectContaining({ provider: "srb", model: "auto", servedModel: "qwen3-coder", requests: 1 }),
    ]);
  });
});
