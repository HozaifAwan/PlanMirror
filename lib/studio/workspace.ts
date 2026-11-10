import type { AgDataSourcesDefinition, AgReportState, AgResponsiveLayoutBreakpoint } from "ag-studio";
import type { StudioRegistry } from "./workspace-registry";
import type { StudioFinding } from "./types";

/** Every row is one recorded finding. Counts never imply a financial risk score. */
export function workspaceData(records: StudioFinding[]): AgDataSourcesDefinition<StudioRegistry> {
  return { sources: [{
    id: "auditFindings",
    name: "Selected audit findings",
    description: "Recorded comparison results only. Findings is a row count, not an amount or risk score.",
    primaryKeyField: "Inspect",
    data: records.map(record => ({
      Inspect: record.id,
      Offer: record.finding.offerLabel,
      Field: record.finding.field.replaceAll("_", " "),
      Status: record.finding.status === "needs_review" ? "Needs review" : record.finding.status === "match" ? "Match" : "Mismatch",
      Advertised: record.advertisedDisplay ?? "Advertised value unavailable",
      Configured: record.configuredDisplay ?? "Configured value unavailable",
      Findings: 1,
    })),
  }] };
}

export function workspaceState(): AgReportState<StudioRegistry> {
  return {
    selectedPageId: "findings",
    panels: { ai: { collapsed: true, width: 360 }, filters: { collapsed: true }, data: { collapsed: false }, edit: { collapsed: false } },
    pages: [{
      id: "findings",
      layout: { minWidth: 0, columns: 24, rowHeight: 28, pagePadding: 12, widgetPadding: 16, backgroundColor: "#f1f5fa", widgetBorderEnabled: true, widgetBorderColor: "#dce5ef", widgetBorderRadius: 14 },
      widgets: {
        verdicts: {
          type: "donut-chart",
          sort: [{ field: { id: "auditFindings.Status" }, direction: "asc" }],
          dataMapping: { categoryKey: [{ id: "auditFindings.Status" }], valueKey: [{ id: "auditFindings.Findings", aggregation: "sum" }] },
          format: { title: { enabled: true, text: "Where promises stand" }, subtitle: { enabled: true, text: "Click a verdict to focus the workspace" }, crossFilter: "highlight", triggerCrossFilter: true },
        },
        matrix: {
          type: "pivot-grid",
          dataMapping: { rows: [{ id: "auditFindings.Field" }], columns: [{ id: "auditFindings.Status" }], values: [{ id: "auditFindings.Findings", aggregation: "sum" }] },
          format: { title: { enabled: true, text: "Terms under the lens" }, subtitle: { enabled: true, text: "Finding counts by billing term and verdict" }, style: { columnAutoSize: true, totalColumns: true, grandTotalRow: { enabled: true } }, crossFilter: "filter" },
        },
        evidence: {
          type: "grid",
          dataMapping: { cols: ["Inspect", "Offer", "Field", "Status", "Advertised", "Configured"].map(name => ({ id: `auditFindings.${name}` })) },
          format: { title: { enabled: true, text: "Trace every finding" }, subtitle: { enabled: true, text: "Inspect a row to compare its recorded source evidence" }, style: { columnAutoSize: true }, crossFilter: "filter", triggerCrossFilter: false },
        },
      },
      widgetLayout: {
        verdicts: { xTrack: 0, yTrack: 0, xSpan: 8, ySpan: 11 },
        matrix: { xTrack: 8, yTrack: 0, xSpan: 16, ySpan: 11 },
        evidence: { xTrack: 0, yTrack: 11, xSpan: 24, ySpan: 15 },
      },
    }],
  };
}

/** Stack the native widgets on narrow canvases, retaining their authored order. */
export const workspaceBreakpoints: AgResponsiveLayoutBreakpoint[] = [{
  maxWidth: 720,
  layout: layouts => {
    let nextRow = 0;
    return layouts.map(({ layout }) => {
      const result = { ...layout, xTrack: 0, yTrack: nextRow, xSpan: 24 };
      nextRow += layout.ySpan;
      return result;
    });
  },
}];
