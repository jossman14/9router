"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Modal } from "@/shared/components";

async function copyKey(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function KeySecretModal({ value, onClose }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => close(), 60_000);
    return () => clearTimeout(timer);
  }, [value]);

  return createPortal(
    <Modal isOpen={!!value} title="API Key" onClose={onClose}>
      <div className="flex flex-col gap-4" role="dialog" aria-modal="true" aria-label="API key value">
        <p className="text-sm text-text-muted">
          Store this key securely. You can show or copy it again from the API Keys list.
          This view closes after one minute.
        </p>
        <div className="flex gap-2">
          <Input
            aria-label="API key value"
            value={value || ""}
            readOnly
            autoFocus
            onFocus={(event) => event.target.select()}
            className="flex-1 min-w-0 font-mono text-sm"
          />
          <Button variant="secondary" icon={copied ? "check" : "content_copy"} onClick={async () => {
            const ok = await copyKey(value);
            setCopied(ok);
            setError(ok ? "" : "Automatic copy failed. Select the key above and copy it manually.");
          }}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <Button onClick={onClose} fullWidth>Done</Button>
      </div>
    </Modal>,
    document.body
  );
}

export default function ApiKeyValue({ apiKey }) {
  const [value, setValue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const recoverable = !!apiKey.key || apiKey.hasEncrypted === true;
  const prefix = apiKey.keyPrefix || apiKey.key?.slice(0, 12);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function reveal(shouldCopy) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let plaintext = apiKey.key;
      if (!plaintext) {
        const res = await fetch(`/api/keys/${encodeURIComponent(apiKey.id)}/reveal`, { method: "POST", cache: "no-store" });
        const data = await res.json();
        if (!res.ok || typeof data.key !== "string" || !data.key) {
          throw new Error(data.error || "Unable to retrieve API key.");
        }
        plaintext = data.key;
      }
      if (shouldCopy && await copyKey(plaintext)) {
        setCopied(true);
      } else {
        setValue(plaintext);
        if (shouldCopy) setError("Automatic copy failed. Copy manually from the dialog.");
      }
    } catch (err) {
      setError(err.message || "Unable to retrieve API key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-xs text-text-muted font-mono">{prefix ? `${prefix}••••••••` : "Hidden key"}</code>
        <Button variant="ghost" size="sm" disabled={!recoverable || busy} onClick={() => reveal(false)} aria-label={`Show key ${apiKey.name}`}>
          Show
        </Button>
        <Button variant="secondary" size="sm" icon={copied ? "check" : "content_copy"} disabled={!recoverable || busy} onClick={() => reveal(true)} aria-label={`Copy key ${apiKey.name}`}>
          {busy ? "Loading…" : copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      {!recoverable && <p className="text-xs text-text-muted mt-1">This older key was stored as a hash only and cannot be shown again. Create a new key if you no longer have it.</p>}
      {error && <p role="alert" className="text-sm text-red-500 mt-1">{error}</p>}
      {value && <KeySecretModal value={value} onClose={() => setValue(null)} />}
    </div>
  );
}
