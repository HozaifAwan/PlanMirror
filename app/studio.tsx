"use client";

import type { ComponentProps } from "react";
import { studioTheme } from "ag-studio";
import { AgStudio } from "ag-studio-react";
import { useMemo } from "react";
import type { AuditState } from "./audit-action";

const evidenceTheme = studioTheme.withParams({
  backgroundColor: "#ffffff",
  textColor: "#003087",
  studioCanvasBackgroundColor: "#d9f0ff",
  studioWidgetBackgroundColor: "#ffffff",
  gridHeaderBackgroundColor: "#d9f0ff",
  gridDataBackgroundColor: "#ffffff",
  gridOddRowBackgroundColor: "#f3f8fe",
});

const initialState: ComponentProps<typeof AgStudio>["initialState"] = {
  selectedPageId: "findings",
  pages: [{
    id: "findings",
    layout: { columns: 12, rowHeight: 40 },
    widgetLayout: { evidence: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 8 } },
    widgets: {
      evidence: {
        type: "grid",
        dataMapping: { cols: ["field", "status", "advertised", "configured", "planId", "paypalField"].map(id => ({ id: `auditFindings.${id}` })) },
        format: { title: { text: "Subscription evidence", enabled: true }, style: { columnAutoSize: true } },
      },
    },
  }],
};

export default function Studio({ rows }: { rows: NonNullable<AuditState["rows"]> }) {
  const data = useMemo(() => ({ sources: [{ id: "auditFindings", data: rows }] }), [rows]);
  return <div className="h-[620px] overflow-auto rounded-xl border border-line bg-paper text-ink">
    <AgStudio data={data} initialState={initialState} theme={evidenceTheme} mode="edit" />
  </div>;
}
