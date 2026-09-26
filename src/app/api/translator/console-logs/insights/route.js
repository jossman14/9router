import { NextResponse } from "next/server";
import { getEvents } from "@/lib/consoleEventBuffer";

export const dynamic = "force-dynamic";

// Aggregate structured events into the groupings the console-log page shows:
// requests (start/done/error) grouped by provider / source / model / component,
// success+failure counts, and top-5 error reasons per dimension.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowParam = searchParams.get("window") || "all";
    const limitParam = Number(searchParams.get("limit")) || 2000;

    let events = getEvents();
    if (windowParam !== "all") {
      const minutes = windowParam === "15m" ? 15 : windowParam === "1h" ? 60 : windowParam === "6h" ? 360 : 1440;
      const cutoff = Date.now() - minutes * 60_000;
      events = events.filter((e) => e.ts >= cutoff);
    }
    events = events.slice(-limitParam);

    const starts = events.filter((e) => e.phase === "start");
    const dones = events.filter((e) => e.phase === "done");
    const errors = events.filter((e) => e.level === "error" && e.phase === "error");
    const warns = events.filter((e) => e.level === "warn");

    const okCount = dones.length;
    const failCount = errors.length;
    const totalFinished = okCount + failCount;

    // Helper: build a grouped bucket for one key function.
    const groupBy = (keyFn, errKeyFn) => {
      const map = new Map();
      const ensure = (key, sample) => {
        if (!map.has(key)) {
          map.set(key, {
            key,
            provider: sample?.provider || null,
            model: sample?.model || null,
            source: sample?.source || null,
            component: sample?.component || null,
            requests: 0,
            ok: 0,
            error: 0,
            warn: 0,
            errors: new Map(),
            lastTs: 0,
          });
        }
        return map.get(key);
      };
      const bumpErr = (bucket, errKey, e, verr) => {
        if (!errKey) return;
        if (!bucket.errors.has(errKey)) {
          bucket.errors.set(errKey, { reason: errKey, count: 0, component: e.component, lastTs: 0 });
        }
        const eb = bucket.errors.get(errKey);
        eb.count++;
        eb.lastTs = Math.max(eb.lastTs, e.ts);
        void verr;
      };

      // Requests: count starts so a request that never finished still shows.
      for (const e of starts) ensure(keyFn(e), e).requests++;
      for (const e of dones) { const b = ensure(keyFn(e), e); b.ok++; b.lastTs = Math.max(b.lastTs, e.ts); }
      for (const e of errors) {
        const b = ensure(keyFn(e), e);
        b.error++;
        b.lastTs = Math.max(b.lastTs, e.ts);
        bumpErr(b, errKeyFn(e), e);
      }
      for (const e of warns) {
        const b = ensure(keyFn(e), e);
        b.warn++;
        b.lastTs = Math.max(b.lastTs, e.ts);
        bumpErr(b, errKeyFn(e), e);
      }

      return Array.from(map.values())
        .map((b) => {
          const finished = b.ok + b.error;
          const denom = finished || b.requests || 0;
          const topErrors = Array.from(b.errors.values())
            .sort((a, c) => c.count - a.count)
            .slice(0, 5);
          return {
            key: b.key,
            provider: b.provider,
            model: b.model,
            source: b.source,
            component: b.component,
            requests: b.requests || finished,
            ok: b.ok,
            error: b.error,
            warn: b.warn,
            successRate: denom ? Math.round((b.ok / denom) * 1000) / 10 : 0,
            failureRate: denom ? Math.round((b.error / denom) * 1000) / 10 : 0,
            lastTs: b.lastTs,
            topErrors,
          };
        })
        .sort((a, c) => (c.error - a.error) || (c.requests - a.requests))
        .map((b) => ({ ...b, topErrors: b.topErrors }));
    };

    const shortId = (s) => (s && s.length > 18 ? s.slice(0, 16) + "…" : s);
    // Normalize IPv4-mapped addresses and classify the network of the source.
    const normSource = (raw) => {
      const s = raw || "local";
      const ip = s.startsWith("::ffff:") ? s.slice(7) : s;
      let type = "local";
      if (ip !== "local") {
        if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") type = "local";
        else if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) type = "private";
        else type = "public";
      }
      return { ip, type, label: type === "local" ? "Local" : type === "private" ? "Private" : "Public" };
    };

    const byProvider = groupBy((e) => e.provider || "(unknown)", (e) => e.reason);
    const bySource = groupBy((e) => normSource(e.source).ip, (e) => e.reason).map((b) => {
      const info = normSource(b.key);
      return { ...b, sourceType: info.type, sourceLabel: info.label };
    });
    const byModel = groupBy((e) => `${e.provider || "?"} / ${e.model || "?"}`, (e) => e.reason);
    const byComponent = groupBy((e) => e.component || "other", (e) => e.reason);

    // Global top-5 error reasons and where they came from.
    const globalErrMap = new Map();
    for (const e of [...errors, ...warns]) {
      const reason = e.reason || "(no message)";
      if (!globalErrMap.has(reason)) {
        globalErrMap.set(reason, { reason, count: 0, component: e.component, providers: new Set(), lastTs: 0 });
      }
      const b = globalErrMap.get(reason);
      b.count++;
      b.lastTs = Math.max(b.lastTs, e.ts);
      if (e.provider) b.providers.add(shortId(e.provider));
    }
    const topErrors = Array.from(globalErrMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((b) => ({ ...b, providers: Array.from(b.providers).slice(0, 5), providersCount: b.providers.size }));

    return NextResponse.json({
      success: true,
      generatedAt: Date.now(),
      window: windowParam,
      totals: {
        events: events.length,
        requests: starts.length,
        done: okCount,
        error: failCount,
        warn: warns.length,
        finished: totalFinished,
        successRate: totalFinished ? Math.round((okCount / totalFinished) * 1000) / 10 : 0,
        failureRate: totalFinished ? Math.round((failCount / totalFinished) * 1000) / 10 : 0,
      },
      byProvider,
      bySource,
      byModel,
      byComponent,
      topErrors,
    });
  } catch (error) {
    console.error("[console-insights] failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
