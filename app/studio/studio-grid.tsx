"use client";

import { useMemo } from "react";
import { AgStudio, AgStudioProvider, createWidgets, type AgWidgetCustomCellRendererProps } from "ag-studio-react";
import { studioTheme, type AgReportState, type AgWidgetField } from "ag-studio";
import type { StudioFinding } from "../../lib/studio/types";

const theme = studioTheme.withParams({ fontFamily: "Helvetica, Arial, sans-serif", textColor: "#000000", backgroundColor: "#ffffff", accentColor: "#0066f5", studioCanvasFontFamily: "Helvetica, Arial, sans-serif", studioWidgetTitleFontFamily: '"Century Gothic", Futura, Helvetica, Arial, sans-serif', studioWidgetBorderRadius: 12, studioMinWidth: 0, studioCanvasMinWidth: 0, studioMinHeight: 480, gridRowHeight: 48, gridHeaderHeight: 48, gridHeaderBackgroundColor: "#f0f4f9", gridHeaderTextColor: "#253548", gridHeaderFontSize: 13, gridHeaderFontWeight: 700, gridCellFontSize: 14, gridCellHorizontalPadding: 16, gridDataBackgroundColor: "#ffffff", gridOddRowBackgroundColor: "#fafbfd", gridRowHoverColor: "#edf5ff", gridRowBorder: { color: "#e5eaf0", width: 1 }, gridHeaderRowBorder: { color: "#d9e1eb", width: 1 }, gridColumnBorder: false, gridHeaderColumnBorderHeight: 0, gridWrapperBorder: false });
const initialState: AgReportState = {
  pages: [{ id: "findings", widgets: { evidence: { type: "grid", dataMapping: { cols: ["Inspect", "Field", "Status", "Advertised", "Configured"].map((name) => ({ id: `auditFindings.${name}` })) }, format: { title: { enabled: false, text: "Findings" }, style: { columnWidth: 150 } } } }, widgetLayout: { evidence: { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 24 } } }], selectedPageId: "findings",
};

export default function FindingsGrid({ records, selectedId, onSelect, licenseKey }: { records: StudioFinding[]; selectedId?: string; onSelect: (id: string) => void; licenseKey?: string }) {
  const data = useMemo(() => ({ sources: [{ id: "auditFindings", data: records.map((record) => ({ Inspect: record.id, Field: record.finding.field.replaceAll("_", " "), Status: record.finding.status === "needs_review" ? "Needs review" : record.finding.status === "match" ? "Match" : "Mismatch", Advertised: record.advertisedDisplay ?? "Advertised value unavailable", Configured: record.configuredDisplay ?? "Configured value unavailable" })) }] }), [records]);
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
  return <AgStudioProvider licenseKey={licenseKey}><AgStudio className="studio-sdk" mode="view" panels={{ view: { left: [], right: [] } }} data={data} initialState={initialState} widgets={widgets} theme={theme} /></AgStudioProvider>;
}
