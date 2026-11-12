"use client";

import Link from "next/link";
import { formatAdvertisedDisplay } from "../../lib/studio/to-studio-run";
import { useState, type FormEvent } from "react";
import { compareMerchantPreview, extractMerchantPreview, listSandboxPlans, type ListPlansResult, type RunAuditResult } from "./actions";

type Preview = Extract<Awaited<ReturnType<typeof extractMerchantPreview>>, { ok: true }>;

export default function MerchantSearch() {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview>();
  const [offer, setOffer] = useState("");
  const [plans, setPlans] = useState<ListPlansResult>();
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RunAuditResult>();

  async function loadPlans() {
    setLoadingPlans(true);
    try { setPlans(await listSandboxPlans()); }
    catch { setPlans({ ok: false, code: "request_failed", error: "Could not load sandbox plans. Retry loading plans." }); }
    finally { setLoadingPlans(false); }
  }

  async function extract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const url = String(new FormData(event.currentTarget).get("sourceUrl") ?? "").trim();
    setBusy(true);
    setPreview(undefined);
    setResult(undefined);
    setError("");
    try {
      const next = await extractMerchantPreview(url);
      if (!next.ok) { setError(next.error ?? "This page needs manual review."); return; }
      setPreview(next);
      const labels = new Set(next.claims.map(claim => claim.offerLabel));
      setOffer(labels.size === 1 ? next.claims[0].offerLabel : "");
      if (!loadingPlans && !plans?.ok) void loadPlans();
    } catch { setError("The extraction request was interrupted. Try again."); }
    finally { setBusy(false); }
  }

  async function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || !offer || busy) return;
    const planId = String(new FormData(event.currentTarget).get("planId") ?? "");
    setBusy(true);
    setResult(undefined);
    setError("");
    try { setResult(await compareMerchantPreview({ previewId: preview.previewId, offerLabel: offer, planId })); }
    catch { setError("The comparison was interrupted. Try again."); }
    finally { setBusy(false); }
  }

  const labels = [...new Set(preview?.claims.map(claim => claim.offerLabel))];
  return <>
    <form className="pm-audit-form" onSubmit={extract} aria-busy={busy}>
      <label>Website pricing URL<input name="sourceUrl" type="url" placeholder="https://example.com/pricing" maxLength={2048} required disabled={busy}
        onChange={() => { setPreview(undefined); setResult(undefined); setError(""); }} /></label>
      <button className="pm-primary-action" disabled={busy}>Extract offers</button>
    </form>
    {busy && <p role="status">Working on your request…</p>}
    {error && <p role="alert">{error}</p>}
    {preview && <form className="pm-audit-form" onSubmit={compare}>
      <h2>Extracted website offers</h2>
      <label>Website offer<select value={offer} required disabled={busy} onChange={event => { setOffer(event.target.value); setResult(undefined); }}>
        <option value="" disabled>Select an extracted offer</option>
        {labels.map(label => <option key={label}>{label}</option>)}
      </select></label>
      {offer && <ul>{preview.claims.filter(claim => claim.offerLabel === offer).map((claim, index) =>
        <li key={index}><strong>{claim.field.replaceAll("_", " ")}</strong><p>{formatAdvertisedDisplay(claim)}</p><blockquote>{claim.evidence.quote}</blockquote></li>)}</ul>}
      <h2>Compare with a sandbox test plan</h2>
      <p>These plans belong to the connected test account. You can inspect extracted terms without choosing a plan.</p>
      {loadingPlans && <p role="status">Loading PayPal sandbox plans…</p>}
      {plans?.ok === false && <p role="alert">{plans.error}</p>}
      {plans?.ok && <label>PayPal sandbox test plan<select name="planId" defaultValue="" required disabled={busy} onChange={() => setResult(undefined)}>
        <option value="" disabled>Select a test plan</option>
        {plans.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.status}</option>)}
      </select></label>}
      <button type="button" onClick={() => void loadPlans()} disabled={busy || loadingPlans}>Reload sandbox plans</button>
      <button className="pm-primary-action" disabled={busy || !offer || loadingPlans || !plans?.ok}>Compare</button>
    </form>}
    {result?.ok === false && <p role="alert">{result.error}</p>}
    {result?.ok && <div role="status">
      <p>Website offer vs. sandbox test configuration · {result.run.status === "completed" ? "Comparison complete" : "Needs review"}</p>
      <Link className="pm-primary-action" href={`/studio?run=${result.runId}`}>Open in AG Studio</Link>
    </div>}
    <p><Link href="/quillfox">Try the Quillfox walkthrough</Link></p>
  </>;
}
