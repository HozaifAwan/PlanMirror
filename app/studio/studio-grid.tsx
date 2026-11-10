"use client";

import { useMemo, useRef, useState } from "react";
import { AgStudio, AgStudioProvider, createWidgets, type AgWidgetCustomCellRendererProps } from "ag-studio-react";
import { studioTheme, type AgStudioApi, type AgWidgetField } from "ag-studio";
import type { StudioFinding } from "../../lib/studio/types";
import { workspaceBreakpoints, workspaceData, workspaceState } from "../../lib/studio/workspace";

const theme = studioTheme.withParams({ fontFamily: "Helvetica, Arial, sans-serif", textColor: "#000000", backgroundColor: "#ffffff", accentColor: "#0066f5", studioCanvasFontFamily: "Helvetica, Arial, sans-serif", studioWidgetTitleFontFamily: '"Century Gothic", Futura, Helvetica, Arial, sans-serif', studioWidgetBorderRadius: 12, studioMinWidth: 0, studioCanvasMinWidth: 0, studioMinHeight: 480, gridRowHeight: 48, gridHeaderHeight: 48, gridHeaderBackgroundColor: "#f0f4f9", gridHeaderTextColor: "#253548", gridHeaderFontSize: 13, gridHeaderFontWeight: 700, gridCellFontSize: 14, gridCellHorizontalPadding: 16, gridDataBackgroundColor: "#ffffff", gridOddRowBackgroundColor: "#fafbfd", gridRowHoverColor: "#edf5ff", gridRowBorder: { color: "#e5eaf0", width: 1 }, gridHeaderRowBorder: { color: "#d9e1eb", width: 1 }, gridColumnBorder: false, gridHeaderColumnBorderHeight: 0, gridWrapperBorder: false });

export default function FindingsGrid({ records, selectedId, onSelect, licenseKey }: { records: StudioFinding[]; selectedId?: string; onSelect: (id: string) => void; licenseKey?: string }) {
  const data = useMemo(() => workspaceData(records), [records]);
  const initialState = useMemo(() => workspaceState(), []);
  const api = useRef<AgStudioApi | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const widgets = useMemo(() => {
    function InspectCell({ value }: AgWidgetCustomCellRendererProps) {
      const id = typeof value === "string" ? value : undefined;
      const record = records.find((item) => item.id === id);
      return record ? <button className="studio-inspect" aria-pressed={selectedId === record.id} aria-label={`Inspect ${record.finding.offerLabel} ${record.finding.field}`} onClick={() => onSelect(record.id)}>Inspect</button> : <span>Finding unavailable</span>;
    }
    function StatusCell({ value }: AgWidgetCustomCellRendererProps) {
      const label = typeof value === "string" ? value : "Unavailable";
      return <span className={`studio-status studio-${label.toLowerCase().replaceAll(" ", "_")}`}>{label}</span>;
    }
    return createWidgets({ overrides: [{ id: "grid", options: { createCellRenderer: (field: AgWidgetField) => field.fieldId === "auditFindings.Inspect" ? InspectCell : field.fieldId === "auditFindings.Status" ? StatusCell : undefined } }] });
  }, [records, selectedId, onSelect]);
  return <div className="studio-investigation">
    <div className="studio-investigation-toolbar">
      <div><span className="studio-eyebrow">Follow the evidence</span><p>Choose a verdict in the chart, then inspect a finding. Click the chart background to clear its selection. Chart selections apply here only; evidence export always includes the full run.</p></div>
      <div className="studio-investigation-actions">
        <button type="button" className="studio-workspace-button" aria-pressed={customizing} onClick={() => setCustomizing(value => !value)}>{customizing ? "Finish customizing" : "Customize dashboard"}</button>
        <button type="button" className="studio-workspace-button" onClick={() => { api.current?.setState(workspaceState()); setCustomizing(false); }}>Reset workspace</button>
      </div>
    </div>
    {customizing && <p className="studio-builder-note" role="status">Drag fields onto the canvas to add views. Rearrange and resize widgets with the Studio controls. These changes affect this workspace only; audit findings and PayPal settings stay read-only.</p>}
    <AgStudioProvider licenseKey={licenseKey}><AgStudio className="studio-sdk studio-sdk-workspace" mode={customizing ? "edit" : "view"} panels={{ view: { left: [], right: ["filters"] }, edit: { left: ["data"], right: ["edit", "filters"] } }} enableFilterEditingInViewMode responsiveLayoutBreakpoints={workspaceBreakpoints} onApiReady={event => { api.current = event.api; }} data={data} initialState={initialState} widgets={widgets} theme={theme} /></AgStudioProvider>
  </div>;
}
