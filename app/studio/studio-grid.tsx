"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgStudio, AgStudioProvider, createWidgets, type AgWidgetCustomCellRendererProps } from "ag-studio-react";
import { AgStudioAiModule, studioTheme, type AgAiHarnessSetupParams, type AgStudioApi, type AgWidgetField } from "ag-studio";
import type { StudioRun } from "../../lib/studio/types";
import type { StudioRegistry } from "../../lib/studio/workspace-registry";
import { clearCanvasScope, scopeFromState, verdictColors, withScope, type InvestigationScope } from "../../lib/studio/workspace-controller";
import { allowedWidgetTypes, buildAuditor } from "../../lib/studio/agent";
import { EvidenceContext, FindingReference, evidenceWidgetDefinition } from "./evidence-widget";
import { workspaceBreakpoints, workspaceData, workspaceState } from "../../lib/studio/workspace";

const theme = studioTheme.withParams({ fontFamily: "Helvetica, Arial, sans-serif", textColor: "#000000", backgroundColor: "#ffffff", accentColor: "#0066f5", studioCanvasFontFamily: "Helvetica, Arial, sans-serif", studioWidgetTitleFontFamily: '"Century Gothic", Futura, Helvetica, Arial, sans-serif', studioWidgetBorderRadius: 12, studioMinWidth: 0, studioCanvasMinWidth: 0, studioMinHeight: 480, gridRowHeight: 48, gridHeaderHeight: 48, gridHeaderBackgroundColor: "#f0f4f9", gridHeaderTextColor: "#253548", gridHeaderFontSize: 13, gridHeaderFontWeight: 700, gridCellFontSize: 14, gridCellHorizontalPadding: 16, gridDataBackgroundColor: "#ffffff", gridOddRowBackgroundColor: "#fafbfd", gridRowHoverColor: "#edf5ff", gridRowBorder: { color: "#e5eaf0", width: 1 }, gridHeaderRowBorder: { color: "#d9e1eb", width: 1 }, gridColumnBorder: false, gridHeaderColumnBorderHeight: 0, gridWrapperBorder: false });

export default function FindingsGrid({ run, scope, selectedId, onSelect, onScope, licenseKey, aiEnabled }: { run: StudioRun; scope: InvestigationScope; selectedId?: string; onSelect: (id: string) => void; onScope: (scope: InvestigationScope) => void; licenseKey?: string; aiEnabled: boolean }) {
  const records = run.findings;
  const data = useMemo(() => workspaceData(records), [records]);
  const initialState = useMemo(() => workspaceState(), []);
  const api = useRef<AgStudioApi<StudioRegistry> | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const agent = useRef<ReturnType<typeof buildAuditor> | null>(null);
  const live = useRef({ scope, selectedId, onSelect, onScope });
  useEffect(() => { live.current = { scope, selectedId, onSelect, onScope }; });
  const [customizing, setCustomizing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const canvas = host.current?.querySelector<HTMLElement>(".ag-studio-root-canvas");
    if (canvas) canvas.inert = busy;
    return () => { if (canvas) canvas.inert = false; };
  }, [busy]);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [canvasScope, setCanvasScope] = useState(false);
  const [resetNote, setResetNote] = useState("");
  const available = aiEnabled && ["completed", "needs_review"].includes(run.status) && records.length > 0;
  const applyScope = useCallback((next: InvestigationScope) => {
    const sdk = api.current;
    live.current.scope = next;
    if (sdk) { const state = sdk.getState(); sdk.setState(withScope(next.status === "all" && next.field === "all" ? clearCanvasScope(state) : state, next)); }
    live.current.onScope(next);
  }, []);
  const inspect = useCallback((id: string) => {
    if (!records.some(record => record.id === id)) return;
    live.current.selectedId = id;
    live.current.onSelect(id);
  }, [records]);
  useEffect(() => {
    const sdk = api.current;
    if (!sdk) return;
    const current = scopeFromState(sdk.getState());
    if (current.status !== scope.status || current.field !== scope.field) sdk.setState(withScope(sdk.getState(), scope));
  }, [scope]);
  useEffect(() => () => { agent.current?.dispose(); agent.current = null; }, []);
  const ai = useMemo(() => available ? ({ api: core }: AgAiHarnessSetupParams) => {
    const sdk = core as AgStudioApi;
    agent.current?.dispose();
    const result = buildAuditor(sdk, {
      run,
      context: () => ({ runId: run.id, source: run.source, totalFindings: records.length, scope: live.current.scope, selectedFindingId: live.current.selectedId, page: api.current?.getState().pages.find(page => page.id === "findings"), limitations: "Immutable recorded findings. Counts only. Additional canvas selections are separate from canonical filters." }),
      select: inspect,
      scope: applyScope,
    }, setBusy);
    agent.current = result;
    return result.harness;
  } : undefined, [available, run, records.length, inspect, applyScope]); // live controller values are read through the ref
  const widgets = useMemo(() => {
    function InspectCell({ value }: AgWidgetCustomCellRendererProps) {
      const id = typeof value === "string" ? value : undefined;
      const record = records.find((item) => item.id === id);
      return record ? <button className="studio-inspect" aria-pressed={selectedId === record.id} aria-label={`Inspect ${record.finding.offerLabel} ${record.finding.field}`} onClick={() => inspect(record.id)}>Inspect</button> : <span>Finding unavailable</span>;
    }
    function StatusCell({ value }: AgWidgetCustomCellRendererProps) {
      const label = typeof value === "string" ? value : "Unavailable";
      return <span className={`studio-status studio-${label.toLowerCase().replaceAll(" ", "_")}`}>{label}</span>;
    }
    const configured = createWidgets<StudioRegistry>({ additionalTypes: [evidenceWidgetDefinition], overrides: [{ id: "grid", options: { createCellRenderer: (field: AgWidgetField) => field.fieldId === "auditFindings.Inspect" ? InspectCell : field.fieldId === "auditFindings.Status" ? StatusCell : undefined } }] });
    return { ...configured, widgets: configured.widgets.filter(widget => allowedWidgetTypes.includes(widget.id)) };
  }, [records, selectedId, inspect]);
  const scopedLabels = useMemo(() => [...new Set(records.filter(record => (scope.status === "all" || record.finding.status === scope.status) && (scope.field === "all" || record.finding.field === scope.field)).map(record => record.finding.status === "needs_review" ? "Needs review" : record.finding.status === "match" ? "Match" : "Mismatch"))].sort(), [records, scope.status, scope.field]);
  const coloredTheme = useMemo(() => theme.withParams(Object.fromEntries(scopedLabels.map((label, index) => [`chartPaletteFills${index + 1}Color`, verdictColors[label as keyof typeof verdictColors]]))), [scopedLabels]);
  return <div className="studio-investigation">
    <div className="studio-investigation-toolbar">
      <div><span className="studio-eyebrow">Follow the evidence</span><p>Choose a verdict in the chart, then inspect a finding. Click the chart background to clear its selection. Chart selections apply here only; evidence export always includes the full run.</p></div>
      <div className="studio-investigation-actions">
        <button type="button" className="studio-workspace-button" disabled={!available} aria-pressed={chatOpen} onClick={() => {
          setChatOpen(value => !value);
          const sdk = api.current; if (sdk) { const state = sdk.getState(); sdk.setState({ ...state, panels: { ...state.panels, ai: { collapsed: chatOpen, width: 360 } } }); }
        }}>Ask Auditor</button>
        <button type="button" className="studio-workspace-button" disabled={busy || !history.undo} onClick={() => api.current?.undo()}>Undo</button>
        <button type="button" className="studio-workspace-button" disabled={busy || !history.redo} onClick={() => api.current?.redo()}>Redo</button>
        <button type="button" className="studio-workspace-button" disabled={busy} aria-pressed={customizing} onClick={() => setCustomizing(value => !value)}>{customizing ? "Finish customizing" : "Customize dashboard"}</button>
        <button type="button" className="studio-workspace-button" onClick={() => { agent.current?.cancel(); api.current?.setState(workspaceState()); applyScope({ status: "all", field: "all" }); onSelect(records[0]?.id ?? ""); setCustomizing(false); setChatOpen(false); setResetNote("Workspace reset. Earlier Auditor messages describe the previous workspace; conversation retained."); }}>Reset workspace</button>
      </div>
    </div>
    {!available && <p className="studio-builder-note">{aiEnabled ? "Ask Auditor needs a completed audit with findings." : "Configure OPENAI_API_KEY on the server to enable Ask Auditor. Manual investigation is available."}</p>}
    {busy && <p role="status" className="studio-builder-note">Auditor is working. Manual layout changes are paused; use Stop in chat to interrupt.</p>}
    {resetNote && <p role="status" className="studio-builder-note">{resetNote}</p>}
    {canvasScope && <p className="studio-selection-note" role="status">Additional canvas filters or chart selections are active. Accessible records and exports use the canonical investigation scope and full run respectively.</p>}
    {customizing && <p className="studio-builder-note" role="status">Drag fields onto the canvas to add views. Rearrange and resize widgets with the Studio controls. These changes affect this workspace only; audit findings and PayPal settings stay read-only.</p>}
    <div ref={host} className={busy ? "studio-canvas-locked" : undefined}>
    <EvidenceContext.Provider value={{ run, selectedId, visibleIds: records.filter(record => (scope.status === "all" || record.finding.status === scope.status) && (scope.field === "all" || record.finding.field === scope.field)).map(record => record.id), select: inspect, clearFilters: () => applyScope({ status: "all", field: "all" }) }}>
    <AgStudioProvider licenseKey={licenseKey}><AgStudio<StudioRegistry> localeText={{ panelTitleAi: "Ask Auditor", aiMessageInputPlaceholder: "Ask about this audit…" }} modules={[AgStudioAiModule]} ai={ai} aiToolDisplay={{
      get_finding_evidence: { label: () => ({ text: "Read recorded evidence" }), detail: FindingReference },
      select_finding: { label: () => ({ text: "Inspect finding" }), detail: FindingReference },
      get_audit_context: { label: () => ({ text: "Read current investigation" }) },
      set_investigation_scope: { label: () => ({ text: "Update investigation filters" }) },
    }} className={`studio-sdk studio-sdk-workspace${busy ? " studio-sdk-busy" : ""}`} mode={customizing || chatOpen || busy ? "edit" : "view"} panels={{ view: { left: [], right: [] }, edit: { left: busy || !customizing ? [] : ["data"], right: busy ? ["ai"] : chatOpen ? ["ai"] : ["edit"] } }} responsiveLayoutBreakpoints={workspaceBreakpoints} onApiReady={event => { api.current = event.api as unknown as AgStudioApi<StudioRegistry>; }} onStateUpdated={event => {
      const sdk = event.api;
      const nextHistory = { undo: sdk.getHistory().undo.length, redo: sdk.getHistory().redo.length };
      setHistory(current => current.undo === nextHistory.undo && current.redo === nextHistory.redo ? current : nextHistory);
      const next = scopeFromState(event.state);
      if (next.status !== live.current.scope.status || next.field !== live.current.scope.field) { live.current.scope = next; live.current.onScope(next); }
      const page = event.state.pages.find(page => page.id === "findings");
      setCanvasScope(Boolean(page?.crossFilter && Object.keys(page.crossFilter).length) || Boolean(page?.filter?.widget && Object.keys(page.filter.widget).length) || Boolean(page?.filter?.page?.some(filter => !["auditFindings.Status", "auditFindings.Field"].includes(filter.field.id))));
    }} data={data} initialState={initialState} widgets={widgets} theme={coloredTheme} /></AgStudioProvider>
    </EvidenceContext.Provider>
    </div>
  </div>;
}
