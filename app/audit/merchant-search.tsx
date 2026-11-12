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
    const read = (name: string) => String(data.get(name) ?? "");
    setBusy(true);
    setResult(undefined);
    try {
      setResult(await runPlanAudit({
        mode: "custom",
        planId: read("planId").trim(),
        password: read("password"),
        source: {
          sourceUrl: read("sourceUrl").trim(),
          sourceText: read("sourceText"),
          offerLabel: read("offerLabel"),
        },
      }));
    } catch {
      setResult({ ok: false, code: "request_failed", error: "The audit request was interrupted. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="pm-audit-form" onSubmit={submit} aria-busy={busy}>
        <label>Pricing page URL<input name="sourceUrl" type="url" required /></label>
        <label>Offer name as shown on the page<input name="offerLabel" maxLength={200} required /></label>
        <label>Pricing text (optional)<textarea name="sourceText" maxLength={20000} rows={6} aria-describedby="pricing-text-help" /></label>
        <p id="pricing-text-help" className="pm-caption">Leave blank to read a supported pricing page. If the page can’t be read, paste the visible offer here.</p>
        <label>PayPal Sandbox plan ID<input name="planId" placeholder="P-…" required /></label>
        <label>Demo password<input name="password" type="password" maxLength={256} required /></label>
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
