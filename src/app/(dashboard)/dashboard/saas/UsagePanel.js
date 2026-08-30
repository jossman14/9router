import { IconChart } from "@/app/landing/components/Icons";
import { compactTokens, dateTime, num } from "./format";

export function ModelBreakdown({ byModel }) {
  const max = Math.max(1, ...byModel.map((m) => m.tokens));
  return (
    <section className="sd-panel" aria-labelledby="model-title">
      <div className="sd-panel__head">
        <div>
          <h2 className="sd-panel__title" id="model-title">Pemakaian per model</h2>
          <p className="sd-panel__sub">14 hari terakhir</p>
        </div>
      </div>
      {byModel.length === 0 ? (
        <div className="sd-empty">
          <span className="sd-empty__icon" aria-hidden="true"><IconChart /></span>
          <p className="sd-empty__title">Belum ada pemakaian</p>
          <p className="sd-empty__body">Data akan muncul setelah permintaan pertama Anda diproses.</p>
        </div>
      ) : (
        <div className="sd-panel__body sd-panel__body--flush sd-tablewrap">
          <table className="sd-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Provider</th>
                <th scope="col" className="sd-num">Permintaan</th>
                <th scope="col" className="sd-num">Token</th>
                <th scope="col" style={{ width: "26%" }}>Porsi</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((m) => (
                <tr key={m.model}>
                  <td className="sd-mono">{m.model}</td>
                  <td>{m.provider}</td>
                  <td className="sd-num">{num(m.requests)}</td>
                  <td className="sd-num">{compactTokens(m.tokens)}</td>
                  <td>
                    <div className="sd-quota__bar" style={{ height: 8 }}>
                      <span className="sd-quota__fill" style={{ width: `${(m.tokens / max) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RecentRequests({ recent }) {
  return (
    <section className="sd-panel" aria-labelledby="recent-title">
      <div className="sd-panel__head">
        <div>
          <h2 className="sd-panel__title" id="recent-title">Permintaan terakhir</h2>
          <p className="sd-panel__sub">25 permintaan terbaru</p>
        </div>
      </div>
      {recent.length === 0 ? (
        <div className="sd-empty">
          <span className="sd-empty__icon" aria-hidden="true"><IconChart /></span>
          <p className="sd-empty__title">Belum ada permintaan</p>
          <p className="sd-empty__body">
            Arahkan aplikasi Anda ke endpoint 9Router untuk melihat riwayat di sini.
          </p>
        </div>
      ) : (
        <div className="sd-panel__body sd-panel__body--flush sd-tablewrap">
          <table className="sd-table">
            <thead>
              <tr>
                <th scope="col">Waktu</th>
                <th scope="col">Model</th>
                <th scope="col">Key</th>
                <th scope="col" className="sd-num">Token</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={`${r.timestamp}-${i}`}>
                  <td>{dateTime(r.timestamp)}</td>
                  <td className="sd-mono">{r.model || "—"}</td>
                  <td className="sd-mono">{r.apiKey || "—"}</td>
                  <td className="sd-num">{num(r.tokens)}</td>
                  <td>
                    <span className="sd-badge" data-tone={r.status === "ok" ? "ok" : "bad"}>
                      {r.status === "ok" ? "Berhasil" : r.status || "Gagal"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
