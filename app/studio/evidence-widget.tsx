"use client";
import { createContext, useContext, useEffect } from "react";
import type { AgAiToolDetailParams, AgStudioApi, AgWidgetParams } from "ag-studio";
import type { AgWidgetDefinition } from "ag-studio-react";
import type { EvidenceData } from "../../lib/studio/workspace-registry";
import type { StudioRun } from "../../lib/studio/types";
import Mirror from "./mirror";
import Evidence from "./evidence";

export const EvidenceContext = createContext<{
  run: StudioRun; selectedId?: string; visibleIds: string[];
  select(id: string): void; clearFilters(): void;
} | null>(null);

export default function EvidenceWidget({ format, widgetApi }: AgWidgetParams<EvidenceData>) {
  useEffect(() => { widgetApi.setDisplayState("displayed"); }, [widgetApi]);
  const context = useContext(EvidenceContext);
  const pinnedId = (format as { findingId?: unknown } | undefined)?.findingId;
  const id = typeof pinnedId === "string" && pinnedId ? pinnedId : context?.selectedId;
  const record = context?.run.findings.find(record => record.id === id);
  if (!context || !record) return <div className="studio-canvas-evidence"><h3>Promise vs configuration</h3><p>Select a finding to inspect its recorded evidence. Unavailable references cannot resolve against another run.</p></div>;
  const hidden = !context.visibleIds.includes(record.id);
  return <article className="studio-canvas-evidence" aria-label="Promise vs configuration">
    <p className="studio-eyebrow">{context.run.source === "live" ? "Live sandbox audit" : "Sample data"} · Recorded evidence</p>
    <h3>Promise vs configuration</h3>
    {hidden && <div className="studio-selection-note" role="status"><p>Selected finding is outside the current filters</p><button onClick={context.clearFilters}>Clear filters</button>{context.visibleIds[0] && <button onClick={() => context.select(context.visibleIds[0])}>Select visible finding</button>}</div>}
    <Mirror record={record} /><Evidence record={record} panel source={context.run.source} />
  </article>;
}

/** Tool-result citations resolve through current same-run IDs, never model-written links. */
export function FindingReference({ args, result, status }: AgAiToolDetailParams) {
  const context = useContext(EvidenceContext);
  const id = typeof args.findingId === "string" ? args.findingId : undefined;
  const record = context?.run.findings.find(record => record.id === id);
  if (status !== "done" || !result?.success || !record || !context) return <p>Recorded finding reference unavailable.</p>;
  return <button className="studio-inspect" onClick={() => context.select(record.id)}>Inspect {record.finding.offerLabel} · {record.finding.field.replaceAll("_", " ")}</button>;
}

export const evidenceWidgetDefinition: AgWidgetDefinition<"planmirror-evidence", EvidenceData> = {
  id: "planmirror-evidence", label: "Promise vs configuration", comp: EvidenceWidget,
  defaultSize: { width: 440, height: 560 }, minSize: { width: 240, height: 240 },
  form: params => params.createDefaults({ dataMappingItems: [] }),
  // A command exposes the public SDK shape builder; compiling it has no side effect.
  formatShape: ({ api }) => (api as AgStudioApi).defineAiCommand(s => ({ input: s.object({}), execute: () => ({ success: true, value: {} }) })).shape,
  ai: { description: "Exact recorded evidence for the shared selected finding. Configuration cannot write evidence.", usage: "Use for advertised versus configured comparison. Follows Inspect selection." },
};
