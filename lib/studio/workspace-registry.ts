import type { AgDefaultRegistry, AgWidgetData, AgWidgetDataFormat } from "ag-studio";
import type { AgRegistry, AgWidgetDefinition } from "ag-studio-react";
export type EvidenceData = AgWidgetData<Record<string, never>, AgWidgetDataFormat<unknown> & { findingId?: string }> & { type: "planmirror-evidence" };
export interface StudioRegistry extends Omit<AgDefaultRegistry, "widgets" | "components" | "aiToolDisplay"> {
  components: Record<string, never>;
  aiToolDisplay: AgRegistry["aiToolDisplay"];
  widgets: readonly (AgDefaultRegistry["widgets"][number] | AgWidgetDefinition<"planmirror-evidence", EvidenceData>)[];
}
