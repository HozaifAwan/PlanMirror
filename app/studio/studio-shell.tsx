"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { studioRuns } from "../../lib/studio/fixtures";
import { evidenceReport, visibleFindings, type FieldFilter, type StatusFilter } from "../../lib/studio/types";
import Evidence from "./evidence";
import StudioMarkdown from "./studio-markdown";

const FindingsGrid = dynamic(() => import("./studio-grid"), { ssr: false, loading: () => <p role="status">Loading AG Studio findings grid…</p> });
const overview = [
  { status: "all", label: "All findings", description: "The full picture" },
  { status: "mismatch", label: "Mismatches", description: "Promises to check" },
  { status: "needs_review", label: "Needs review", description: "More context needed" },
  { status: "match", label: "Matches", description: "Evidence aligns" },
] as const;
const fields = ["trial", "recurring_price", "billing_interval", "setup_fee"] as const;
const readable = (value: string) => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

export default function StudioShell({ licenseKey }: { licenseKey?: string }) {
  const [runId, setRunId] = useState(studioRuns[0].id);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [field, setField] = useState<FieldFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButton = useRef<HTMLButtonElement>(null);
  const activeFilters = Number(status !== "all") + Number(field !== "all");
  function closeFilters() { setFiltersOpen(false); filterButton.current?.focus(); }
  const [view, setView] = useState("grid");
  const [selectedId, setSelectedId] = useState<string | undefined>(studioRuns[0].findings[0]?.id);
  const run = studioRuns.find((item) => item.id === runId)!;
  const visible = visibleFindings(run, status, field);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];

  function changeFilters(nextStatus: StatusFilter, nextField: FieldFilter) {
    setStatus(nextStatus);
    setField(nextField);
    const next = visibleFindings(run, nextStatus, nextField);
    setSelectedId(next.find((item) => item.id === selectedId)?.id ?? next[0]?.id);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidenceReport(run), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${run.id}-evidence.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main aria-labelledby="studio-title" id="main-content" tabIndex={-1} className="pm-container studio-page" data-testid="studio-page">
    <header className="studio-heading">
      <div><p className="studio-eyebrow">Audit workspace</p><h1 id="studio-title">Your promises, under review.</h1><p>Compare subscription promises with the billing evidence behind them.</p></div>
      <span className="studio-fixture">Sample data · Read-only</span>
    </header>
    <StudioMarkdown run={run} availableRuns={studioRuns} status={status} field={field} view={view} selectedId={selected?.id} />

    <section aria-label="Audit run" className="studio-run">
      <div className="studio-run-toolbar">
        <label className="studio-scenario">Sample scenario<select value={runId} onChange={(event) => {
          const next = studioRuns.find((item) => item.id === event.target.value)!;
          setRunId(next.id); setSelectedId(next.findings[0]?.id); setStatus("all"); setField("all");
        }}>{studioRuns.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className="studio-export"><button className="pm-primary-action" onClick={download} aria-describedby="export-scope" disabled={run.status === "not_started" || run.status === "failed"}>Export all evidence <span aria-hidden="true">↗</span></button><p id="export-scope">JSON · All run findings, regardless of filters</p></div>
      </div>
      <div className="studio-run-status"><p><span className={`studio-run-dot studio-${run.status}`} aria-hidden="true" /><strong>{readable(run.status)}</strong><span className="studio-meta">Source: fixture</span></p><details><summary>Run details</summary><p>{run.description}</p><p className="studio-meta">Run ID: {run.id}</p>{run.issues.length > 0 && <ul>{run.issues.map((issue) => <li key={issue.code}><strong>{issue.code}:</strong> {issue.message}{issue.claimId && <span className="studio-meta"> · Claim ID: {issue.claimId}</span>}</li>)}</ul>}</details></div>
      {run.issues.length > 0 && <p className="studio-issue-summary">{run.issues.length} run {run.issues.length === 1 ? "issue" : "issues"} · {run.issues[0].message}</p>}
      {(run.status === "not_started" || run.status === "failed") && <p className="studio-issue-summary">Evidence export is unavailable because this run has no audit result.</p>}
    </section>

    <div className="studio-counts" role="group" aria-label="Filter findings by status">{overview.map((item) => <button key={item.status} aria-pressed={status === item.status} onClick={() => changeFilters(item.status, field)}><span>{item.label}</span><strong>{item.status === "all" ? run.findings.length : run.findings.filter((record) => record.finding.status === item.status).length}</strong><small>{item.description}</small></button>)}</div>

    <div className="studio-workspace">
      <section aria-labelledby="findings-heading" className="studio-card studio-findings">
        <div className="studio-section-heading"><div><p className="studio-eyebrow">Review the details</p><h2 id="findings-heading">Findings</h2></div><span className="studio-total">{run.findings.length} records</span></div>
        <div className="studio-controls">
          <div className="studio-view-switch" role="group" aria-label="Records view"><button aria-pressed={view === "grid"} onClick={() => setView("grid")}>Studio grid</button><button aria-pressed={view === "accessible"} onClick={() => setView("accessible")}>Accessible records</button></div>
          <button ref={filterButton} onKeyDown={(event) => { if (event.key === "Escape" && filtersOpen) { event.preventDefault(); closeFilters(); } }} className="studio-filter-toggle" aria-expanded={filtersOpen} aria-controls="findings-filters" onClick={() => setFiltersOpen(!filtersOpen)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>Filters{activeFilters > 0 && <span className="studio-filter-count" aria-label={`${activeFilters} active filters`}>{activeFilters}</span>}</button>
        </div>
        <div id="findings-filters" className="studio-filter-panel" hidden={!filtersOpen} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeFilters(); } }}>
          <div className="studio-filter-panel-heading"><strong>Filter findings</strong><button className="studio-reset" onClick={closeFilters}>Close filters</button></div>
          <div className="studio-filter-fields"><label>Finding status<select value={status} onChange={(event) => changeFilters(event.target.value as StatusFilter, field)}><option value="all">All statuses</option>{overview.filter((item) => item.status !== "all").map((item) => <option key={item.status} value={item.status}>{item.label}</option>)}</select></label>
          <label>Finding field<select value={field} onChange={(event) => changeFilters(status, event.target.value as FieldFilter)}><option value="all">All fields</option>{fields.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></label>
          <button className="studio-reset" onClick={() => changeFilters("all", "all")} disabled={!activeFilters}>Reset filters</button></div>
        </div>
        <p className="studio-scope" role="status">{visible.length} of {run.findings.length} findings · {field === "all" ? "All fields" : readable(field)} · {status === "all" ? "All statuses" : readable(status)}</p>
        {visible.length === 0 ? <div className="studio-empty"><h3>{run.status === "not_started" ? "No audit yet" : "No findings to show"}</h3><p>{run.findings.length ? "No findings match these filters. Reset filters to restore the run." : "This run contains no findings. Review its status and run details above."}</p></div> : view === "grid" ? <div data-markdown-exclude className="studio-grid-container"><FindingsGrid key={`${run.id}-${status}-${field}`} licenseKey={licenseKey} records={visible} selectedId={selected?.id} onSelect={setSelectedId} /></div> : <div data-markdown-exclude className="studio-records"><table><caption>Current visible findings — complete records below</caption><thead><tr><th scope="col">Offer / field</th><th scope="col">Status</th><th scope="col">Summary</th><th scope="col">Action</th></tr></thead><tbody>{visible.map((record) => <tr key={record.id}><th scope="row">{record.finding.offerLabel} / {readable(record.finding.field)}</th><td><span className={`studio-status studio-${record.finding.status}`}>{readable(record.finding.status)}</span></td><td>{record.finding.summary}</td><td><button aria-pressed={selected?.id === record.id} aria-label={`Inspect ${record.finding.offerLabel} ${record.finding.field}`} onClick={() => setSelectedId(record.id)}>Inspect</button></td></tr>)}</tbody></table>{visible.map((record) => <article key={record.id} id={`record-${record.id}`}><h3>{record.finding.offerLabel} — {readable(record.finding.field)}</h3><Evidence record={record} /></article>)}</div>}
      </section>
      <section className="studio-card studio-evidence-panel" aria-labelledby="evidence-heading" data-markdown-exclude><div className="studio-section-heading"><div><p className="studio-eyebrow">Behind the finding</p><h2 id="evidence-heading">Evidence</h2></div><span className="studio-readonly">Read-only</span></div>{selected ? <Evidence record={selected} panel /> : <div className="studio-empty"><h3>No evidence selected</h3><p>{visible.length ? "Select a finding to inspect its evidence." : "Evidence will appear here when findings are available."}</p></div>}</section>
    </div>
  </main>;
}
