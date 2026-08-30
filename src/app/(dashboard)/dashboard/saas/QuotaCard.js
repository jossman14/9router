import { compactTokens, daysUntil, num } from "./format";

/** Quota now lives on the user's selected package, not the account. */
export default function QuotaCard({ user }) {
  const sub = user.subscription;

  if (!sub) {
    return (
      <section className="sd-panel" aria-labelledby="quota-title">
        <div className="sd-panel__head">
          <div>
            <h2 className="sd-panel__title" id="quota-title">Kuota token</h2>
            <p className="sd-panel__sub">Belum ada paket aktif</p>
          </div>
        </div>
        <div className="sd-panel__body">
          <div className="lp-alert lp-alert--error">
            <span>
              Anda belum punya paket aktif, jadi permintaan API akan ditolak.
              Pilih paket di tab <b>Paket &amp; Tagihan</b>.
            </span>
          </div>
        </div>
      </section>
    );
  }

  const pct = sub.usedPercent || 0;
  const level = pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";
  const left = daysUntil(sub.expiresAt);

  return (
    <section className="sd-panel" aria-labelledby="quota-title">
      <div className="sd-panel__head">
        <div>
          <h2 className="sd-panel__title" id="quota-title">Kuota token</h2>
          <p className="sd-panel__sub">
            Paket {sub.packageName}
            {sub.allowedModels.length > 0 && ` · ${sub.allowedModels.length} model`}
          </p>
        </div>
        <span className="sd-plan">{sub.packageName}</span>
      </div>

      <div className="sd-panel__body">
        <div className="sd-quota">
          <div className="sd-quota__row">
            <span className="sd-quota__big">
              {compactTokens(sub.tokensUsed)}{" "}
              <span className="sd-quota__of">dari {compactTokens(sub.tokenQuota)}</span>
            </span>
            <span className="sd-quota__of">{pct.toFixed(1)}% terpakai</span>
          </div>

          <div
            className="sd-quota__bar"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Pemakaian kuota token paket aktif"
          >
            <span className="sd-quota__fill" data-level={level} style={{ width: `${Math.max(pct, 1.5)}%` }} />
          </div>

          <div className="sd-quota__foot">
            <span>Sisa {num(sub.tokensRemaining)} token</span>
            <span>{left === null ? "—" : `Paket berlaku ${left} hari lagi`}</span>
          </div>
        </div>

        {sub.allowedModels.length > 0 && (
          <div className="lp-chiprow" style={{ marginTop: "1rem" }}>
            {sub.allowedModels.map((m) => <span className="lp-chip" key={m}>{m}</span>)}
          </div>
        )}

        {level !== "ok" && (
          <div className={`lp-alert ${level === "over" ? "lp-alert--error" : "lp-alert--ok"}`} style={{ marginTop: "1.1rem" }}>
            <span>
              {level === "over"
                ? "Kuota paket ini sudah habis. Beli paket baru atau pilih paket lain agar permintaan bisa jalan lagi."
                : "Kuota Anda tersisa di bawah 20%. Siapkan paket berikutnya agar layanan tidak terhenti."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
