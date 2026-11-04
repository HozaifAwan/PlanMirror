"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { runAudit, type AuditState } from "./audit-action";

const Studio = dynamic(() => import("./studio"), {
  ssr: false,
  loading: () => <p role="status">Loading AG Studio…</p>,
});

export default function AuditConsole({ initial }: { initial: AuditState }) {
  const [state, audit, pending] = useActionState(runAudit, initial);
  const [showStudio, setShowStudio] = useState(false);
  const result = state.error ? initial : state;
  const rows = result.rows ?? [];
  return (
    <div className="space-y-7">
      <form action={audit} className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <button disabled={pending} name="mode" value="fixture" className="rounded-lg bg-emerald-300 px-4 py-2 font-semibold text-slate-950">Run mismatch demo</button>
          <button disabled={pending} name="mode" value="corrected" className="rounded-lg border border-slate-600 px-4 py-2">Rerun with corrected sample</button>
        </div>
        <details className="rounded-xl border border-slate-700 p-4">
          <summary className="cursor-pointer font-semibold">Audit a live PayPal sandbox plan</summary>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">Plan ID<input name="planId" placeholder="P-…" maxLength={50} className="rounded-md border border-slate-600 p-2" /></label>
            <label className="grid gap-1 text-sm">Audit token<input name="token" type="password" autoComplete="off" className="rounded-md border border-slate-600 p-2" /></label>
            <button disabled={pending} name="mode" value="sandbox" className="rounded-lg bg-emerald-300 px-4 py-2 font-semibold text-slate-950">Read sandbox plan</button>
          </div>
        </details>
      </form>
      {pending && <p role="status">Running audit…</p>}
      {state.error && <p role="alert" className="text-rose-300">{state.error} Showing the initial sample below.</p>}
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Audit findings</h2>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-emerald-300">{result.source === "paypal_sandbox" ? "Live PayPal sandbox" : "Sample data"}</span>
        </div>
        {result.retrievedAt && <p className="mt-2 text-sm text-slate-400">Retrieved {result.retrievedAt}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {rows.map(row => <article key={row.field} className="rounded-xl border border-slate-700 p-4">
            <p className={row.status === "Match" ? "text-emerald-300" : "text-amber-300"}>{row.status}</p>
            <h3 className="mt-2 font-semibold">{row.field}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-400">Advertised</dt><dd>{row.advertised}</dd>
              <dt className="text-slate-400">Configured</dt><dd>{row.configured}</dd>
            </dl>
            <p className="mt-3 break-words text-xs text-slate-400">{row.planId} · {row.paypalField}</p>
          </article>)}
        </div>
      </section>
      <button className="rounded-lg border border-slate-600 px-4 py-2" aria-expanded={showStudio} onClick={() => setShowStudio(!showStudio)}>{showStudio ? "Hide AG Studio" : "Explore findings in AG Studio"}</button>
      {showStudio && <Studio rows={rows} />}
    </div>
  );
}
