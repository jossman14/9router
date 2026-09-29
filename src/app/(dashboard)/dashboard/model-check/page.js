"use client";

import { useEffect, useState } from "react";
import { Card, Button, Badge, ModelSelectModal } from "@/shared/components";

const VERDICTS = {
  genuine: { label: "Looks genuine", variant: "success", icon: "verified" },
  suspicious: { label: "Suspicious", variant: "warning", icon: "help" },
  masked: { label: "Likely masked", variant: "error", icon: "gpp_bad" },
  unknown: { label: "Not enough signal", variant: "default", icon: "question_mark" },
  error: { label: "Probe failed", variant: "error", icon: "error" },
};

const PASS_ICON = { true: ["check_circle", "text-green-500"], false: ["cancel", "text-red-500"], null: ["remove_circle", "text-text-muted"] };

function ModelField({ label, value, onPick, onClear, hint }) {
  return (
    <div>
      <div className="text-xs font-medium text-text-main mb-1">{label}</div>
      <div className="flex gap-2">
        <button
          onClick={onPick}
          className="flex-1 text-left px-3 py-2 rounded-lg border border-border-subtle bg-surface hover:bg-surface-2 text-sm font-mono truncate cursor-pointer"
        >
          {value || <span className="text-text-muted font-sans">Choose a model…</span>}
        </button>
        {value && onClear && (
          <button onClick={onClear} aria-label={`Clear ${label}`} className="px-2 rounded-lg hover:bg-surface-2 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

function ProbeDetail({ title, probe }) {
  if (!probe) return null;
  return (
    <div className="p-3 rounded-lg bg-surface-2 text-xs space-y-1">
      <div className="font-semibold text-text-main">{title}: <code>{probe.requested}</code></div>
      {probe.ok ? (
        <>
          <div>Returned model: <code>{probe.returnedModel || "—"}</code> · prompt tokens: {probe.promptTokens ?? "—"} · {probe.latencyMs} ms</div>
          <pre className="whitespace-pre-wrap break-words text-text-muted">{probe.reply || "(empty reply)"}</pre>
        </>
      ) : (
        <div className="text-red-500">{probe.error}</div>
      )}
    </div>
  );
}

export default function ModelCheckPage() {
  const [providers, setProviders] = useState([]);
  const [model, setModel] = useState("");
  const [reference, setReference] = useState("");
  const [picking, setPicking] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch("/api/providers").then((r) => r.json()).then((d) => setProviders(d.connections || [])).catch(() => {});
  }, []);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/models/mask-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, reference }),
      });
      const data = await res.json();
      setResult(res.ok ? data : { verdict: "error", checks: [], target: { requested: model, ok: false, error: data.error } });
    } catch (err) {
      setResult({ verdict: "error", checks: [], target: { requested: model, ok: false, error: err.message } });
    } finally {
      setRunning(false);
    }
  };

  const v = result && VERDICTS[result.verdict];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card padding="md">
        <h1 className="text-base font-semibold text-text-main">Model Mask Check</h1>
        <p className="text-xs text-text-muted mt-1">
          Checks whether a provider really serves the model it advertises. Three signals: the model name the upstream
          echoes back, the vendor the model says it is, and the prompt-token count against a reference model you trust.
          Models can lie about who they are, so the tokenizer comparison is the strongest signal.
        </p>
        <div className="grid gap-4 mt-4 sm:grid-cols-2">
          <ModelField label="Model to check" value={model} onPick={() => setPicking("model")} />
          <ModelField
            label="Reference model (optional)"
            value={reference}
            onPick={() => setPicking("reference")}
            onClear={() => setReference("")}
            hint="Same model from an official or trusted provider."
          />
        </div>
        <div className="mt-4">
          <Button onClick={run} disabled={!model || running} loading={running}>
            {running ? "Probing…" : "Run check"}
          </Button>
        </div>
      </Card>

      {result && (
        <Card padding="md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">{v.icon}</span>
            <Badge variant={v.variant}>{v.label}</Badge>
            {result.expectedVendor && <span className="text-xs text-text-muted">expected vendor: {result.expectedVendor}</span>}
          </div>
          <ul className="mt-4 space-y-2">
            {result.checks.map((c) => {
              const [icon, color] = PASS_ICON[String(c.pass)];
              return (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
                  <div>
                    <div className="text-text-main">{c.label}</div>
                    <div className="text-xs text-text-muted">{c.detail}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 space-y-2">
            <ProbeDetail title="Target" probe={result.target} />
            <ProbeDetail title="Reference" probe={result.reference} />
          </div>
        </Card>
      )}

      {picking && (
        <ModelSelectModal
          isOpen
          onClose={() => setPicking(null)}
          onSelect={(m) => {
            (picking === "model" ? setModel : setReference)(m?.value || "");
            setPicking(null);
          }}
          activeProviders={providers}
          title={picking === "model" ? "Model to check" : "Reference model"}
          selectedModel={picking === "model" ? model : reference}
        />
      )}
    </div>
  );
}
