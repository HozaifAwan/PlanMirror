"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { evidenceReport, visibleFindings, type FieldFilter, type LiveRunState, type StatusFilter, type StudioRun } from "../../lib/studio/types";
import Evidence from "./evidence";
import Mirror from "./mirror";
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
const emptyRun: StudioRun = { id: "no-audit", label: "No audit loaded", source: "live", status: "not_started", description: "Start a merchant audit and open its result in Studio to inspect your website and PayPal evidence.", findings: [], issues: [] };

export default function StudioShell({
  licenseKey,
  aiEnabled = false,
  liveRun,
  liveRunState = "none",
  requestedRunId,
  initialSampleId,
  sampleRuns = [],
}: {
  licenseKey?: string;
  aiEnabled?: boolean;
  liveRun?: StudioRun;
  liveRunState?: LiveRunState;
  requestedRunId?: string;
  initialSampleId?: string;
  sampleRuns?: StudioRun[];
}) {
  const availableRuns = liveRun ? [liveRun] : sampleRuns.length ? sampleRuns : [emptyRun];
  const initialRun = liveRun ?? sampleRuns.find(item => item.id === initialSampleId) ?? availableRuns[0];
  const [runId, setRunId] = useState(initialRun.id);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [field, setField] = useState<FieldFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButton = useRef<HTMLButtonElement>(null);
  const evidencePanel = useRef<HTMLElement>(null);
  function inspectFinding(id: string) {
    setSelectedId(id);
    evidencePanel.current?.scrollIntoView?.({ block: "nearest", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  const activeFilters = Number(status !== "all") + Number(field !== "all");
  function closeFilters() { setFiltersOpen(false); filterButton.current?.focus(); }
  const [view, setView] = useState("grid");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialRun.findings[0]?.id);
  const run = availableRuns.find((item) => item.id === runId) ?? availableRuns[0];
  const visible = visibleFindings(run, status, field);
  const selected = run.findings.find((item) => item.id === selectedId);

  function changeFilters(nextStatus: StatusFilter, nextField: FieldFilter) {
    setStatus(nextStatus);
    setField(nextField);

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
      <div><p className="studio-eyebrow">Audit workspace</p><h1 id="studio-title">{run.source === "live" ? run.label : "Your promises, under review."}</h1><p>Compare subscription promises with the billing evidence behind them.</p></div>
      {run.status === "not_started" && <Link className="pm-primary-action" href="/audit">Start a merchant audit</Link>}
    </header>
    {liveRunState === "expired" && (
      <p className="studio-issue-summary" role="status" data-testid="live-run-expired">
        The live audit run{requestedRunId ? ` ${requestedRunId}` : ""} expired or was not found. Start a new merchant audit to load fresh evidence.
      </p>
    )}
    <StudioMarkdown run={run} availableRuns={availableRuns} status={status} field={field} view={view} selectedId={selected?.id} liveRunState={liveRunState} />

    <section aria-label="Audit run" className="studio-run">
      <div className="studio-run-toolbar">
        <label className="studio-scenario">Audit run<select value={run.id} onChange={(event) => {
          const next = availableRuns.find((item) => item.id === event.target.value)!;
          setRunId(next.id); setSelectedId(next.findings[0]?.id); setStatus("all"); setField("all");
        }}>{availableRuns.map((item) => <option key={item.id} value={item.id}>{item.source === "live" ? `Live audit · ${item.label}` : item.label}</option>)}</select></label>
        <div className="studio-export"><button className="pm-primary-action" onClick={download} aria-describedby="export-scope" disabled={run.status === "not_started" || run.status === "failed"}>Export all evidence <span aria-hidden="true">↗</span></button><p id="export-scope">JSON · All run findings, regardless of filters</p></div>
      </div>
      <div className="studio-run-status"><p><span className={`studio-run-dot studio-${run.status}`} aria-hidden="true" /><strong>{readable(run.status)}</strong><span className="studio-meta">Source: {run.status === "not_started" ? "no audit data" : run.source === "live" ? "live sandbox audit" : "fixture"}</span></p><details><summary>Run details</summary><p>{run.description}</p>{run.activeSubscriptions !== undefined && <p>{run.activeSubscriptions === null ? "Active sandbox subscription count unavailable." : `${run.activeSubscriptions} active sandbox subscriptions associated with this plan. Association does not establish a billing impact.`}</p>}{run.retrievedAt && <p className="studio-meta">Retrieved: <time dateTime={run.retrievedAt}>{run.retrievedAt}</time></p>}{run.issues.length > 0 && <ul>{run.issues.map((issue) => <li key={`${issue.code}-${issue.claimId ?? "run"}`}><strong>{issue.code}:</strong> {issue.message}</li>)}</ul>}</details></div>
      {run.issues.length > 0 && <p className="studio-issue-summary">{run.issues.length} run {run.issues.length === 1 ? "issue" : "issues"} · {run.issues[0].message}</p>}
      {(run.status === "not_started" || run.status === "failed") && <p className="studio-issue-summary">Evidence export is unavailable because this run has no audit result.</p>}
    </section>

    <div className="studio-counts" role="group" aria-label="Filter findings by status">{overview.map((item) => <button key={item.status} aria-pressed={status === item.status} onClick={() => changeFilters(item.status, field)}><span>{item.label}</span><strong>{item.status === "all" ? run.findings.length : run.findings.filter((record) => record.finding.status === item.status).length}</strong><small>{item.description}</small></button>)}</div>

    <div className="studio-workspace">
      <section aria-labelledby="findings-heading" className="studio-card studio-findings">
        <div className="studio-section-heading"><div><p className="studio-eyebrow">Review the details</p><h2 id="findings-heading">Findings</h2></div><span className="studio-total">{run.findings.length} records</span></div>
        <div className="studio-controls">
          <div className="studio-view-switch" role="group" aria-label="Records view"><button aria-pressed={view === "grid"} onClick={() => setView("grid")}>Audit workspace</button><button aria-pressed={view === "accessible"} onClick={() => setView("accessible")}>Accessible records</button></div>
          <button ref={filterButton} onKeyDown={(event) => { if (event.key === "Escape" && filtersOpen) { event.preventDefault(); closeFilters(); } }} className="studio-filter-toggle" aria-expanded={filtersOpen} aria-controls="findings-filters" onClick={() => setFiltersOpen(!filtersOpen)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>Filters{activeFilters > 0 && <span className="studio-filter-count" aria-label={`${activeFilters} active filters`}>{activeFilters}</span>}</button>
        </div>
        <div id="findings-filters" className="studio-filter-panel" hidden={!filtersOpen} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeFilters(); } }}>
          <div className="studio-filter-panel-heading"><strong>Filter findings</strong><button className="studio-reset" onClick={closeFilters}>Close filters</button></div>
          <div className="studio-filter-fields"><label>Finding status<select value={status} onChange={(event) => changeFilters(event.target.value as StatusFilter, field)}><option value="all">All statuses</option>{overview.filter((item) => item.status !== "all").map((item) => <option key={item.status} value={item.status}>{item.label}</option>)}</select></label>
          <label>Finding field<select value={field} onChange={(event) => changeFilters(status, event.target.value as FieldFilter)}><option value="all">All fields</option>{fields.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></label>
          <button className="studio-reset" onClick={() => changeFilters("all", "all")} disabled={!activeFilters}>Reset filters</button></div>
        </div>
        <p className="studio-scope" role="status">{visible.length} of {run.findings.length} findings · {field === "all" ? "All fields" : readable(field)} · {status === "all" ? "All statuses" : readable(status)}</p>
        <div hidden={view !== "grid"} data-markdown-exclude className="studio-grid-container"><FindingsGrid key={run.id} licenseKey={licenseKey} run={run} scope={{ status, field }} aiEnabled={aiEnabled} selectedId={selectedId} onSelect={inspectFinding} onScope={scope => changeFilters(scope.status, scope.field)} /></div>
        {view === "accessible" && <div data-markdown-exclude className="studio-records"><table><caption>Current visible findings — complete records below</caption><thead><tr><th scope="col">Offer / field</th><th scope="col">Status</th><th scope="col">Summary</th><th scope="col">Action</th></tr></thead><tbody>{visible.map((record) => <tr key={record.id}><th scope="row">{record.finding.offerLabel} / {readable(record.finding.field)}</th><td><span className={`studio-status studio-${record.finding.status}`}>{readable(record.finding.status)}</span></td><td>{record.finding.summary}</td><td><button aria-pressed={selected?.id === record.id} aria-label={`Inspect ${record.finding.offerLabel} ${record.finding.field}`} onClick={() => inspectFinding(record.id)}>Inspect</button></td></tr>)}</tbody></table>{visible.map((record) => <article key={record.id} id={`record-${record.id}`}><h3>{record.finding.offerLabel} — {readable(record.finding.field)}</h3><Evidence record={record} source={run.source} /></article>)}</div>}
      </section>
      <section ref={evidencePanel} className="studio-card studio-evidence-panel" aria-labelledby="evidence-heading" data-markdown-exclude><div className="studio-section-heading"><div><p className="studio-eyebrow">Behind the finding</p><h2 id="evidence-heading">Promise vs configuration</h2></div><span className="studio-readonly">Read-only</span></div>{selected ? <>{!visible.some(record => record.id === selected.id) && <div className="studio-selection-note" role="status">Selected finding is outside the current filters. <button onClick={() => changeFilters("all", "all")}>Clear filters</button>{visible[0] && <button onClick={() => inspectFinding(visible[0].id)}>Select visible finding</button>}</div>}<Mirror record={selected} /><Evidence record={selected} panel source={run.source} /></> : <div className="studio-empty"><h3>No evidence selected</h3><p>{visible.length ? "Select a finding to inspect its evidence." : "Evidence will appear here when findings are available."}</p></div>}</section>
    </div>
  </main>;
}
