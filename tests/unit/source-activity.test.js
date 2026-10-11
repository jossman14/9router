// Self-check for per-IP activity: rows are attributed to the right IP, local
// rows without a source count as "local", and hours bucket in WIB (UTC+7).
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "9r-src-"));

let saveRequestUsage, getSourceActivity;

beforeAll(async () => {
  ({ saveRequestUsage, getSourceActivity } = await import("@/lib/db/repos/usageRepo.js"));
});

const hoursAgo = (h, plusMs = 0) => new Date(Date.now() - h * 3600e3 + plusMs).toISOString();

describe("getSourceActivity", () => {
  it("separates IPs, buckets by WIB hour, and treats source-less rows as local", async () => {
    const base = { provider: "openai", model: "gpt-5", tokens: { prompt_tokens: 10, completion_tokens: 5 } };
    await saveRequestUsage({ ...base, timestamp: hoursAgo(2), source: "203.0.113.7", meta: { source: "203.0.113.7" } });
    await saveRequestUsage({ ...base, timestamp: hoursAgo(2, 1), source: "203.0.113.7", meta: { source: "203.0.113.7" } });
    // Shares a prefix with the IP above; must not leak into its results.
    await saveRequestUsage({ ...base, timestamp: hoursAgo(1), source: "203.0.113.70", meta: { source: "203.0.113.70" } });
    await saveRequestUsage({ ...base, timestamp: hoursAgo(1, 2) });

    const ip = await getSourceActivity("203.0.113.7", "24h");
    expect(ip.totals.requests).toBe(2);
    expect(ip.totals.promptTokens).toBe(20);
    expect(ip.granularity).toBe("hour");
    expect(ip.timeline.reduce((n, b) => n + b.requests, 0)).toBe(2);
    expect(ip.type).toBe("public");

    const wibHour = (new Date(Date.parse(hoursAgo(2))).getUTCHours() + 7) % 24;
    expect(ip.byHour[wibHour].requests).toBe(2);

    expect((await getSourceActivity("203.0.113.70", "24h")).totals.requests).toBe(1);
    expect((await getSourceActivity("local", "24h")).totals.requests).toBe(1);

    const daily = await getSourceActivity("203.0.113.7", "30d");
    expect(daily.granularity).toBe("day");
    expect(daily.timeline.reduce((n, b) => n + b.requests, 0)).toBe(2);
  });

  it("looks up public IPs once, caches them, and never sends private ones out", async () => {
    const { lookupIpGeo } = await import("@/lib/ipGeo.js");
    const realFetch = global.fetch;
    let calls = 0;
    global.fetch = async (url) => {
      calls++;
      expect(String(url)).toContain("ipwho.is/203.0.113.9");
      return { status: 200, json: async () => ({
        success: true, city: "Bandung", region: "West Java", country: "Indonesia", country_code: "ID",
        latitude: -6.9, longitude: 107.6, connection: { isp: "PT Telkom Indonesia", org: "Telkom", asn: 7713 },
      }) };
    };
    try {
      expect(await lookupIpGeo("local")).toBeNull();
      expect(await lookupIpGeo("192.168.1.5")).toBeNull();
      expect(await lookupIpGeo("::ffff:10.0.0.2")).toBeNull();
      expect(calls).toBe(0);

      const geo = await lookupIpGeo("::ffff:203.0.113.9");
      expect(geo).toMatchObject({ city: "Bandung", isp: "PT Telkom Indonesia", asn: 7713, lat: -6.9 });
      await lookupIpGeo("203.0.113.9");
      expect(calls).toBe(1);
    } finally {
      global.fetch = realFetch;
    }
  });
});
