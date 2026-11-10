import type { AgCoreBaseRegistry, AgFilterState, AgReportState } from "ag-studio";
import type { FieldFilter, StatusFilter } from "./types";

export const statuses = ["all", "match", "mismatch", "needs_review"] as const;
export const fields = ["all", "trial", "recurring_price", "billing_interval", "setup_fee"] as const;
export const verdictLabels = { match: "Match", mismatch: "Mismatch", needs_review: "Needs review" } as const;
export const verdictColors = { Match: "#23845a", Mismatch: "#cf424f", "Needs review": "#b27814" };
export interface InvestigationScope { status: StatusFilter; field: FieldFilter }
const scopeFields = ["auditFindings.Status", "auditFindings.Field"];
export function scopeFromState<T extends AgCoreBaseRegistry>(state: AgReportState<T>): InvestigationScope {
  const filters = state.pages.find(page => page.id === "findings")?.filter?.page ?? [];
  const value = (id: string) => filters.find(filter => filter.field.id === id)?.model;
  const statusModel = value(scopeFields[0]);
  const fieldModel = value(scopeFields[1]);
  const statusValue = statusModel && "value" in statusModel ? statusModel.value : undefined;
  const fieldValue = fieldModel && "value" in fieldModel ? fieldModel.value : undefined;
  return {
    status: statuses.find(status => status !== "all" && verdictLabels[status] === statusValue) ?? "all",
    field: fields.find(field => field !== "all" && field.replaceAll("_", " ") === fieldValue) ?? "all",
  };
}
export function withScope<T extends AgCoreBaseRegistry>(state: AgReportState<T>, scope: InvestigationScope): AgReportState<T> {
  const canonical: AgFilterState<T>[] = [];
  if (scope.status !== "all") canonical.push({ field: { id: scopeFields[0] }, model: { operator: "equals", value: verdictLabels[scope.status] } });
  if (scope.field !== "all") canonical.push({ field: { id: scopeFields[1] }, model: { operator: "equals", value: scope.field.replaceAll("_", " ") } });
  return { ...state, pages: state.pages.map(page => page.id !== "findings" ? page : { ...page, filter: { ...page.filter, page: [...(page.filter?.page ?? []).filter(filter => !scopeFields.includes(filter.field.id)), ...canonical] } }) };
}

export function clearCanvasScope<T extends AgCoreBaseRegistry>(state: AgReportState<T>): AgReportState<T> {
  return { ...state, pages: state.pages.map(page => page.id !== "findings" ? page : { ...page, crossFilter: {}, filter: { page: [] } }) };
}
