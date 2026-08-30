const nf = new Intl.NumberFormat("id-ID");

export function compactTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000_000) return `${nf.format(+(v / 1_000_000_000).toFixed(2))} M`;
  if (v >= 1_000_000) return `${nf.format(+(v / 1_000_000).toFixed(2))} jt`;
  if (v >= 1_000) return `${nf.format(+(v / 1_000).toFixed(1))} rb`;
  return nf.format(v);
}

export function num(n) {
  return nf.format(Number(n) || 0);
}

export function money(n) {
  return `$${(Number(n) || 0).toFixed(4)}`;
}

export function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function dateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** Days left in the 30-day billing period that started at `periodStart`. */
export function daysLeft(periodStart) {
  const start = Date.parse(periodStart || "");
  if (!start) return null;
  const end = start + 30 * 86400_000;
  return Math.max(0, Math.ceil((end - Date.now()) / 86400_000));
}
