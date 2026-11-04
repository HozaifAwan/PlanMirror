"use client";

import type { ComponentProps } from "react";
import { studioTheme } from "ag-studio";
import { AgStudio } from "ag-studio-react";
import { useMemo } from "react";
import type { AuditState } from "./audit-action";

const evidenceTheme = studioTheme.withParams({
  backgroundColor: "#fffdf9",
  textColor: "#172c31",
  studioCanvasBackgroundColor: "#e1eceb",
  studioWidgetBackgroundColor: "#fffdf9",
  gridHeaderBackgroundColor: "#e1eceb",
  gridDataBackgroundColor: "#fffdf9",
  gridOddRowBackgroundColor: "#f1f6f4",
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
