"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { runPlanAudit, type RunAuditResult } from "./actions";

export default function MerchantSearch() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunAuditResult>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setResult(undefined);
    try {
      setResult(await runPlanAudit({ mode: "custom", sourceUrl: String(data.get("sourceUrl") ?? "").trim() }));
    } catch {
      setResult({ ok: false, code: "request_failed", error: "The audit request was interrupted. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="pm-audit-form" onSubmit={submit} aria-busy={busy}>
        <label>Website pricing URL<input name="sourceUrl" type="url" placeholder="https://example.com/pricing" maxLength={2048} required disabled={busy} /></label>
        <button className="pm-primary-action" type="submit" disabled={busy}>{busy ? "Running audit…" : "Run audit"}</button>
      </form>
      {result?.ok === false && <p role="alert">{result.error}</p>}
      {result?.ok && (
        <div role="status">
          <p>{result.run.label} · {result.run.status === "completed" ? "Audit complete" : "Needs review"}</p>
          <Link className="pm-primary-action" href={`/studio?run=${result.runId}`}>Open in AG Studio</Link>
        </div>
      )}
    </>
  );
}
