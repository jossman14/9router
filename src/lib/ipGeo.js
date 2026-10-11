import { getAdapter } from "./db/driver.js";
import { parseJson, stringifyJson } from "./db/helpers/jsonCol.js";
import { describeSource } from "./db/repos/usageRepo.js";

// Approximate location + ISP of a client IP, for the admin's per-IP usage view.
// Looked up on demand (never on the request path) and cached, so each address
// is sent to the lookup service at most once a month.
// ponytail: one free HTTPS service (ipwho.is, ~10k lookups/month, no key).
// Swap in an offline GeoLite2/DB-IP mmdb reader if IPs must not leave the box.
const SCOPE = "ipGeo";
const TTL_MS = 30 * 864e5;
const TIMEOUT_MS = 5000;
const FIELDS = "success,message,country,country_code,region,city,latitude,longitude,timezone,connection";

/** null for local/private addresses (nothing to look up), else geo or { error }. */
export async function lookupIpGeo(source) {
  const { ip, type } = describeSource(source);
  if (type !== "public") return null;

  const db = await getAdapter();
  const cached = parseJson(db.get(`SELECT value FROM kv WHERE scope = ? AND key = ?`, [SCOPE, ip])?.value, null);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < TTL_MS) return cached;

  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=${FIELDS}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const d = await res.json();
    if (!d?.success) return { error: d?.message || `HTTP ${res.status}` };
    const geo = {
      ip,
      city: d.city || null,
      region: d.region || null,
      country: d.country || null,
      countryCode: d.country_code || null,
      lat: typeof d.latitude === "number" ? d.latitude : null,
      lon: typeof d.longitude === "number" ? d.longitude : null,
      timezone: d.timezone?.id || null,
      isp: d.connection?.isp || null,
      org: d.connection?.org || null,
      asn: d.connection?.asn || null,
      fetchedAt: new Date().toISOString(),
    };
    db.run(
      `INSERT INTO kv(scope, key, value) VALUES(?, ?, ?) ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value`,
      [SCOPE, ip, stringifyJson(geo)]
    );
    return geo;
  } catch (err) {
    // A stale answer beats none when the service is down.
    return cached || { error: err.name === "TimeoutError" ? "lookup timed out" : "lookup failed" };
  }
}
