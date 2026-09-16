import { describe, it, expect } from "vitest";
import { clearedFallbackState } from "@/app/api/providers/[id]/test/testUtils.js";

describe("clearedFallbackState", () => {
  it("drops error code, backoff, and every model lock", () => {
    const patch = clearedFallbackState({
      name: "srbyte",
      errorCode: 401,
      backoffLevel: 12,
      modelLock_auto: "2026-09-15T01:27:55.273Z",
      "modelLock___all": "2026-09-20T00:00:00.000Z",
    });
    expect(patch).toEqual({
      errorCode: null,
      backoffLevel: 0,
      modelLock_auto: null,
      "modelLock___all": null,
    });
  });

  it("leaves non-lock fields alone", () => {
    expect(clearedFallbackState({ apiKey: "secret", testStatus: "error" })).toEqual({
      errorCode: null,
      backoffLevel: 0,
    });
  });
});
