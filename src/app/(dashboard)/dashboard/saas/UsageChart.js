import { compactTokens, shortDate } from "./format";

/**
 * 14-day token bars. Plain divs — a chart library is not worth 40kB for one
 * bar series, and this keeps the dashboard bundle small.
 */
export default function UsageChart({ series }) {
  const max = Math.max(1, ...series.map((d) => d.tokens));
  const first = series[0]?.date;
  const last = series[series.length - 1]?.date;

  return (
    <section className="sd-panel" aria-labelledby="chart-title">
      <div className="sd-panel__head">
        <div>
          <h2 className="sd-panel__title" id="chart-title">Pemakaian 14 hari terakhir</h2>
          <p className="sd-panel__sub">Total token per hari</p>
        </div>
      </div>
      <div className="sd-panel__body">
        <div className="sd-chart">
          {series.map((d) => (
            <div
              className="sd-chart__col"
              key={d.date}
              title={`${shortDate(d.date)} · ${compactTokens(d.tokens)} token · ${d.requests} permintaan`}
            >
              <span
                className="sd-chart__bar"
                style={{ height: `${d.tokens ? Math.max(4, (d.tokens / max) * 100) : 0}%` }}
              />
            </div>
          ))}
        </div>
        <div className="sd-chart__axis">
          <span>{first ? shortDate(first) : ""}</span>
          <span>Puncak {compactTokens(max)} token</span>
          <span>{last ? shortDate(last) : ""}</span>
        </div>
      </div>
    </section>
  );
}
