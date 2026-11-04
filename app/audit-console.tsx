"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { runAudit, type AuditState } from "./audit-action";

const Studio = dynamic(() => import("./studio"), {
  ssr: false,
  loading: () => <p role="status">Loading AG Studio…</p>,
});

export default function AuditConsole({ initial }: { initial: AuditState & { offerQuote: string } }) {
  const [state, audit, pending] = useActionState(runAudit, initial);
  const [showStudio, setShowStudio] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All findings");
  const result = state.error ? initial : state;
  const rows = result.rows ?? [];
  const filters = ["All findings", "Mismatch", "Needs review", "Match"];
  const visibleRows = statusFilter === "All findings" ? rows : rows.filter(row => row.status === statusFilter);
  function downloadEvidence() {
    const report = {
      version: 1,
      source: result.source,
      advertisedOffer: {
        url: new URL("/quillfox", window.location.href).href,
        quote: result.extractedQuote ?? initial.offerQuote,
        extraction: result.extractedQuote ? "openai" : "known_offer",
      },
      ...(result.retrievedAt && { paypalRetrievedAt: result.retrievedAt }),
      findings: rows,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const download = document.createElement("a");
    download.href = url;
    download.download = result.source === "paypal_sandbox" ? "planmirror-sandbox-evidence.json" : "planmirror-sample-evidence.json";
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-7">
      <form action={audit} className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <button disabled={pending} name="mode" value="fixture" className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Run mismatch demo</button>
          <button disabled={pending} name="mode" value="corrected" className="rounded-lg border border-line px-4 py-2">Rerun with corrected sample</button>
        </div>
        <details className="rounded-xl border border-line p-4">
          <summary className="cursor-pointer font-semibold">Audit a live PayPal sandbox plan</summary>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">Plan ID<input name="planId" placeholder="P-…" maxLength={50} className="rounded-md border border-line p-2" /></label>
            <label className="grid gap-1 text-sm">Audit token<input name="token" type="password" autoComplete="off" className="rounded-md border border-line p-2" /></label>
            <button disabled={pending} name="mode" value="sandbox" className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Read sandbox plan</button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input name="extract" type="checkbox" defaultChecked />
            Extract Quillfox’s advertised terms with AI
          </label>
        </details>
      </form>
      {pending && <p role="status">Running audit…</p>}
      {state.error && <p role="alert" className="text-warning">{state.error} Showing the initial sample below.</p>}
      <section className="rounded-2xl border border-line bg-paper p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Audit findings</h2>
          <span className="rounded-full bg-wash px-3 py-1 text-sm text-accent">{result.source === "paypal_sandbox" ? "Live PayPal sandbox" : "Sample data"}</span>
        </div>
        <button type="button" onClick={downloadEvidence} disabled={pending || Boolean(state.error) || !rows.length}
          className="mt-4 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50">
          Download evidence report
        </button>
        {result.extractedQuote && <p className="mt-2 text-sm text-muted">AI-extracted evidence from Quillfox pricing: “{result.extractedQuote}”</p>}
        {result.retrievedAt && <p className="mt-2 text-sm text-muted">Retrieved {result.retrievedAt}</p>}
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter audit findings">
          {filters.map(filter => (
            <button key={filter} type="button" aria-pressed={statusFilter === filter}
              className={`rounded-full border border-line px-3 py-1.5 text-sm ${statusFilter === filter ? "bg-accent text-white" : "bg-paper text-ink"}`}
              onClick={() => setStatusFilter(filter)}>
              {filter} · {filter === "All findings" ? rows.length : rows.filter(row => row.status === filter).length}
            </button>
          ))}
        </div>
        {visibleRows.length === 0 && <p className="mt-4 text-muted" role="status">No findings in this category.</p>}
        <div className="mt-5 space-y-3">
          <button className="rounded-lg border border-line px-4 py-2" aria-expanded={showStudio} aria-controls="audit-studio" onClick={() => setShowStudio(!showStudio)}>
            {showStudio ? "Hide AG Studio evidence grid" : "Show AG Studio evidence grid"}
          </button>
          <div id="audit-studio">{showStudio && <Studio rows={visibleRows} />}</div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {visibleRows.map(row => <article key={row.field} className="rounded-xl border border-line p-4">
            <p className={row.status === "Match" ? "text-success" : "text-warning"}>{row.status}</p>
            <h3 className="mt-2 font-semibold">{row.field}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Advertised</dt><dd>{row.advertised}</dd>
              <dt className="text-muted">Configured</dt><dd>{row.configured}</dd>
            </dl>
            <p className="mt-3 break-words text-xs text-muted">{row.planId} · {row.paypalField}</p>
          </article>)}
        </div>
      </section>

    </div>
  );
}
