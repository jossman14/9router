const WIB_TIME_ZONE = "Asia/Jakarta";

const wibPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: WIB_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function getWibDateTimeParts(value) {
  return Object.fromEntries(
    wibPartsFormatter.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]),
  );
}

function formatWibTimestamp(value) {
  const part = getWibDateTimeParts(value);
  return `${part.day}/${part.month}/${part.year}, ${part.hour}.${part.minute}.${part.second}`;
}

function formatWibLogTimestamp(value) {
  const part = getWibDateTimeParts(value);
  return `${part.day}-${part.month}-${part.year} ${part.hour}:${part.minute}:${part.second}`;
}

function ranked(entries, label, detail) {
  return Object.entries(entries || {})
    .map(([key, entry]) => ({
      label: label(entry, key),
      detail: detail(entry, key),
      requests: entry.requests || 0,
      tokens: (entry.promptTokens || 0) + (entry.completionTokens || 0),
      cost: entry.cost || 0,
    }))
    .sort((a, b) => b.requests - a.requests || b.tokens - a.tokens);
}

function providerLabel(entry) {
  return entry.provider || "Unknown provider";
}

function getProviderRequestCount(requestCounts = {}, providerId = "") {
  const normalized = providerId.toLowerCase();
  const entry = Object.entries(requestCounts || {}).find(([key]) => key.toLowerCase() === normalized)?.[1];
  return entry?.requests || 0;
}

function buildUsageBreakdown(stats = {}) {
  return {
    endpoints: ranked(stats.byEndpoint, (entry) => entry.endpoint || "Unknown endpoint", providerLabel),
    apiKeys: ranked(stats.byApiKey, (entry) => entry.keyName || entry.apiKeyMasked || "Local (No API Key)", providerLabel),
    providers: ranked(stats.byProvider, (entry, key) => entry.name || entry.provider || key || "Unknown provider", () => ""),
    models: ranked(stats.byModel, (entry) => entry.rawModel || "Unknown model", providerLabel),
    accounts: ranked(
      stats.byAccount,
      (entry) => entry.accountName || "Unknown account",
      (entry) => [entry.rawModel, entry.provider].filter(Boolean).join(" · "),
    ),
    sources: ranked(
      stats.bySource,
      (entry, key) => entry.source || key || "Local",
      () => "Request origin",
    ),
  };
}

export {
  WIB_TIME_ZONE,
  formatWibTimestamp,
  formatWibLogTimestamp,
  buildUsageBreakdown,
  getProviderRequestCount,
};
