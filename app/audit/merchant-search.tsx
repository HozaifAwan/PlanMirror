"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { listSandboxPlans, runPlanAudit, type ListPlansResult, type RunAuditResult } from "./actions";

export default function MerchantSearch() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunAuditResult>();
  const [plans, setPlans] = useState<ListPlansResult>();
  const [loadingPlans, setLoadingPlans] = useState(true);

  async function loadPlans() {
    setLoadingPlans(true);
    try { setPlans(await listSandboxPlans()); }
    catch { setPlans({ ok: false, code: "request_failed", error: "Could not load sandbox plans. Retry loading plans." }); }
    finally { setLoadingPlans(false); }
  }
  useEffect(() => {
    let active = true;
    listSandboxPlans().then(value => { if (active) setPlans(value); })
      .catch(() => { if (active) setPlans({ ok: false, code: "request_failed", error: "Could not load sandbox plans. Retry loading plans." }); })
      .finally(() => { if (active) setLoadingPlans(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setResult(undefined);
    try {
      setResult(await runPlanAudit({ mode: "custom", sourceUrl: String(data.get("sourceUrl") ?? "").trim(), planId: String(data.get("planId") ?? ""), offerLabel: String(data.get("offerLabel") ?? "").trim() || undefined }));
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
        <p>AI reads the pricing page and extracts its advertised billing terms automatically. If the page contains multiple offers, specify one below or the audit will require review.</p>
        <details><summary>Choose a specific website offer (optional)</summary><label>Advertised offer name<input name="offerLabel" placeholder="Exact offer name on the pricing page" maxLength={200} disabled={busy} /></label></details>
        <p id="plan-mapping-help">These plans come from the connected PayPal sandbox account, not from the website. Select the plan belonging to the offer you are auditing. An unrelated website and sandbox plan cannot establish a billing discrepancy for that merchant.</p>
        {loadingPlans && <p role="status">Loading PayPal sandbox plans…</p>}
        {!loadingPlans && plans?.ok === false && <p role="alert">{plans.error}</p>}
        {!loadingPlans && plans?.ok && <label>PayPal sandbox plan<select name="planId" defaultValue="" required disabled={busy} aria-describedby="plan-mapping-help"><option value="" disabled>Select the corresponding plan</option>{plans.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.id} · {plan.status}</option>)}</select></label>}
        <button type="button" onClick={() => void loadPlans()} disabled={busy || loadingPlans}>Reload sandbox plans</button>
        <button className="pm-primary-action" type="submit" disabled={busy || loadingPlans || !plans?.ok}>{busy ? "Running audit…" : "Run audit"}</button>
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
