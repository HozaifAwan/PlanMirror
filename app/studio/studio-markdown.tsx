import type { FieldFilter, StatusFilter, StudioRun } from "../../lib/studio/types";
import { visibleFindings } from "../../lib/studio/types";
import Evidence from "./evidence";

/** Complete semantic counterpart of the virtualized workspace, used by AgentView. */
function RunEvidence({ run, status, field, selected }: { run: StudioRun; status: StatusFilter; field: FieldFilter; selected: boolean }) {
  const visibleIds = new Set(visibleFindings(run, status, field).map(record => record.id));
  return <section>
    <h2>Audit run context</h2>
    <p>Run: {run.label} · Run ID: {run.id} · Status: {run.status} · Source: {run.source} · Illustrative sample data</p>
    <p>{run.description}</p>
    <p>Evidence export: {run.status === "not_started" || run.status === "failed" ? "Unavailable because this run has no audit result" : "Available as JSON"}. Export scope: all findings in this run, regardless of website filters. All available evidence is included below without exporting.</p>
    <h3>Run issues</h3>
    {run.issues.length ? <ul>{run.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.code}: {issue.message}{issue.claimId && ` · Claim ID: ${issue.claimId}`}</li>)}</ul> : <p>No run issues reported.</p>}
    <h2>All finding evidence in {selected ? "the selected run" : "this loaded sample run"}</h2>
    {selected && <p>Website filter scope: {visibleIds.size} of {run.findings.length} findings. Status: {status}; field: {field}. Markdown includes all {run.findings.length} findings regardless of these filters.</p>}
    {run.findings.map(record => <article key={record.id}>
      <h3>{record.finding.offerLabel} — {record.finding.field.replaceAll("_", " ")}</h3>
      {selected && <p>Included in current website filters: {visibleIds.has(record.id) ? "Yes" : "No"}.</p>}
      <Evidence record={record} />
    </article>)}
    {!run.findings.length && <p>This run contains no findings. Consult the run status and issues above.</p>}
  </section>;
}


export default function StudioMarkdown({ run, availableRuns, status, field, view = "grid", selectedId }: { run: StudioRun; availableRuns: StudioRun[]; status: StatusFilter; field: FieldFilter; view?: string; selectedId?: string }) {
  return <section data-markdown-only className="studio-markdown">
    <h2>Current workspace state</h2>
    <p>Available records views: Studio grid; Accessible records. Available status filters: All statuses; Mismatches; Needs review; Matches. Available field filters: All fields; Trial; Recurring price; Billing interval; Setup fee.</p>
    <p>Data availability: all supplied fixture scenarios are included below. No live provider data is loaded or pending in this workspace.</p>
    <p>Selected run ID: {run.id}. Current records view: {view}. Selected finding ID: {selectedId ?? "None"}. Active status filter: {status}. Active field filter: {field}.</p>
    <h2>Selected run</h2>
    <RunEvidence run={run} status={status} field={field} selected />
    <h2>Other already loaded sample scenarios</h2>
    <p>These illustrative fixture scenarios were supplied to this page. They are sample data, not live merchant account data. No scenario selection, inspection or export is needed to read their evidence.</p>
    {availableRuns.filter(item => item.id !== run.id).map(item => <RunEvidence key={item.id} run={item} status="all" field="all" selected={false} />)}
    {availableRuns.every(item => item.id === run.id) && <p>No other sample scenarios supplied.</p>}
  </section>;
}
