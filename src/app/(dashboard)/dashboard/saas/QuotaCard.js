import { compactTokens, daysLeft, num } from "./format";

export default function QuotaCard({ user }) {
  const pct = user.tokenQuota ? Math.min(100, (user.tokensUsed / user.tokenQuota) * 100) : 0;
  const level = pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";
  const left = daysLeft(user.periodStart);

  return (
    <section className="sd-panel" aria-labelledby="quota-title">
      <div className="sd-panel__head">
        <div>
          <h2 className="sd-panel__title" id="quota-title">Kuota token</h2>
          <p className="sd-panel__sub">Paket {user.tierLabel} · periode 30 hari</p>
        </div>
        <span className="sd-plan">{user.tierLabel}</span>
      </div>

      <div className="sd-panel__body">
        <div className="sd-quota">
          <div className="sd-quota__row">
            <span className="sd-quota__big">
              {compactTokens(user.tokensUsed)}{" "}
              <span className="sd-quota__of">dari {compactTokens(user.tokenQuota)}</span>
            </span>
            <span className="sd-quota__of">{pct.toFixed(1)}% terpakai</span>
          </div>

          <div
            className="sd-quota__bar"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Pemakaian kuota token periode berjalan"
          >
            <span className="sd-quota__fill" data-level={level} style={{ width: `${Math.max(pct, 1.5)}%` }} />
          </div>

          <div className="sd-quota__foot">
            <span>Sisa {num(user.tokensRemaining)} token</span>
            <span>{left === null ? "—" : `Periode berakhir dalam ${left} hari`}</span>
          </div>
        </div>

        {level !== "ok" && (
          <div className={`lp-alert ${level === "over" ? "lp-alert--error" : "lp-alert--ok"}`} style={{ marginTop: "1.1rem" }}>
            <span>
              {level === "over"
                ? "Kuota periode ini sudah habis. Permintaan baru akan ditolak sampai periode berikutnya atau paket dinaikkan."
                : "Kuota Anda tersisa di bawah 20%. Pertimbangkan menaikkan paket agar layanan tidak terhenti."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
