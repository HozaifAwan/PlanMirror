import type { AgAiTool, AgApiFilter, AgReportState, AgStudioApi } from "ag-studio";
/** Native queries do not implicitly inherit the canvas filters. Apply them explicitly. */
export function investigationFilter(state: AgReportState): AgApiFilter | undefined {
  const page = state.pages.find(page => page.id === "findings");
  const conditions: AgApiFilter[] = [];
  for (const filter of page?.filter?.page ?? []) {
    if (!filter.model) continue;
    if (filter.model.operator !== "equals" || !("value" in filter.model) || typeof filter.model.value !== "string") throw new Error("This filter cannot be represented in a bounded count query. Clear additional filters first.");
    conditions.push({ field: filter.field, operator: "equals", value: filter.model.value });
  }
  for (const selections of Object.values(page?.crossFilter?.values ?? {})) {
    for (const selection of selections) {
      if (selection.type === "value") conditions.push({ field: selection.field, operator: "isIn", value: selection.values });
      else if (selection.type === "multiValue") conditions.push({ combinator: "or", conditions: selection.values.map(pairs => ({ combinator: "and", conditions: pairs.map(pair => ({ field: pair.field, operator: "equals", value: pair.value })) })) });
      else {
        if (selection.from !== undefined) conditions.push({ field: selection.field, operator: "greaterThanOrEqual", value: selection.from });
        if (selection.to !== undefined) conditions.push({ field: selection.field, operator: "lessThanOrEqual", value: selection.to });
      }
    }
  }
  return conditions.length ? { combinator: "and", conditions } : undefined;
}
export function scopedQuery(tool: AgAiTool, api: AgStudioApi): AgAiTool {
  return { ...tool, execute: async (call, ctx) => {
    const query = call.args.query;
    if (!query || typeof query !== "object" || Array.isArray(query)) return ctx.error("A native query is required.");
    const filter = investigationFilter(api.getState());
    const own = (query as { filter?: AgApiFilter }).filter;
    const scoped = { ...query, limit: { count: 50 }, ...(filter ? { filter: own ? { combinator: "and", conditions: [own, filter] } : filter } : {}) };
    return tool.execute!({ ...call, args: { ...call.args, query: scoped } }, ctx);
  } };
}
