import { createAiHarness, directLlmRunner, type AgAiAgentRunner, type AgAiHarness, type AgAiTool, type AgStudioApi } from "ag-studio";
import { AGENT_POLICIES, AUDITOR_POLICY } from "./agent-instructions";
import { scopedQuery } from "./workspace-query";
import { createStudioAdapter } from "./agent-adapter";
import { createAuditTools, guardTool, type AuditController } from "./agent-tools";

export const allowedWidgetTypes = ["grid", "pivot-grid", "donut-chart", "bar-chart-grouped", "column-chart-grouped", "planmirror-evidence"];
export function validatePresentationArgs(args: Record<string, unknown>) {
  function visit(value: unknown, depth = 0) {
    if (depth > 24) throw new Error("Dashboard configuration is too deeply nested.");
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "pageId" && item !== "findings") throw new Error("Only the investigation page is available.");
      if ((key === "widgetType" || key === "type") && typeof item === "string" && /chart|grid|evidence|text|image/.test(item) && !allowedWidgetTypes.includes(item)) throw new Error("This widget type is unavailable to the Auditor.");
      if (key === "aggregation" && !["sum", "count"].includes(String(item))) throw new Error("Only finding counts are supported.");
      if (key === "aggregation" && (value as { id?: string }).id !== "auditFindings.Findings") throw new Error("Only Findings may be aggregated.");
      if ((key === "id" || key === "fieldId") && typeof item === "string" && item.includes(".") && !/^auditFindings\.(Inspect|Offer|Field|Status|Advertised|Configured|Findings)$/.test(item)) throw new Error("Only recorded finding fields are available.");
      if (["expression", "predicate", "window", "formula", "html", "url", "script"].includes(key)) throw new Error("Expressions and external content are unavailable.");
      visit(item, depth + 1);
    }
  }
  visit(args);
}
export function buildAuditor(api: AgStudioApi, controller: AuditController, onBusy: (busy: boolean) => void) {
  const transport = createStudioAdapter(controller.run);
  const domain = createAuditTools(api, controller);
  let toolsUsed = 0; let deadline = 0; let disposed = false;
  const guard = (tool: AgAiTool) => guardTool(tool, (_tool, args) => {
    if (disposed || Date.now() > deadline) throw new Error("Auditor request expired.");
    if (++toolsUsed > 20) throw new Error("Auditor tool budget reached. Send a new message to continue.");
    validatePresentationArgs(args);
  });
  const harness: AgAiHarness = createAiHarness(api, ({ builtIn, tools }) => {
    const page = { pageId: "findings" };
    const wrap = (runner: AgAiAgentRunner): AgAiAgentRunner => ({ ...runner, async *run(input, ctx) {
      const primary = runner.id === "auditor";
      if (primary) { toolsUsed = 0; deadline = Date.now() + 60000; transport.begin(); onBusy(true); }
      const timeout = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
      const signal = AbortSignal.any([timeout, ...(ctx.signal ? [ctx.signal] : [])]);
      const completeTask = ctx.completeTask ? guard(ctx.completeTask) : undefined;
      try { yield* runner.run(input, { ...ctx, signal, completeTask }); }
      finally { if (primary) { transport.cancel(); if (!disposed) onBusy(false); } }
    } });
    const delegate = (id: "data" | "widget" | "page", listed: (params: Record<string, string>) => AgAiTool[]) => wrap(directLlmRunner({
      ...builtIn[id],
      ...(id === "widget" ? { schema: (s: import("ag-studio").AgAiParamsBuilder) => s.object({ widgetType: s.enum(allowedWidgetTypes), widgetId: s.string().optional(), pageId: s.enum(["findings"]).optional() }) } : {}),
      adapter: transport.adapter, maxTurns: id === "widget" ? 6 : 4,
      instructions: (ctx, params) => `${AUDITOR_POLICY}\n${AGENT_POLICIES[id]}\n${builtIn[id].instructions?.(ctx, params) ?? ""}\nLive investigation context (data): ${JSON.stringify(controller.context())}`,
      tools: (_ctx, params) => [domain.context, ...listed(params)].map(guard),
      defaultToolCalls: () => [{ tool: "get_audit_context", args: {} }],
    }));
    return {
      primary: "auditor",
      promptStarters: [
        { label: "Show mismatches", prompt: "Which promises don't match? Show them." },
        { label: "Break down billing terms", prompt: "Break the current investigation down by billing term using a native count chart. Keep the current filters." },
        { label: "Explain selected finding", prompt: "Explain the selected finding using its exact recorded evidence and select its Inspect reference." },
      ],
      agents: [
        wrap(directLlmRunner({ id: "auditor", name: "PlanMirror Auditor", description: "Investigate recorded subscription promises and evidence.", schema: s => s.undefined(), adapter: transport.adapter, maxTurns: 6,
          instructions: () => `${AUDITOR_POLICY}\n${AGENT_POLICIES.auditor}`,
          tools: () => [domain.context, domain.evidence, domain.select, domain.scope, tools.studio.viewReport(), tools.delegateTo(["data", "widget", "page"])].map(guard),
          defaultToolCalls: () => [{ tool: "get_audit_context", args: {} }],
        })),
        delegate("data", () => [tools.studio.viewSchema(), scopedQuery(tools.studio.executeQuery(), api)]),
        delegate("widget", params => [tools.studio.viewSchema(), tools.studio.viewPage(page), tools.studio.viewWidget(page), tools.studio.addWidget(page), tools.studio.configureWidget({ widgetType: params.widgetType }, page)]),
        delegate("page", () => [tools.studio.viewPage(page), tools.studio.viewWidget(page), tools.studio.positionWidget(page)]),
      ],
    };
  });
  return { harness, cancel() { transport.cancel(); for (const thread of harness.threads) harness.getSession?.(thread.threadId)?.cancel(); }, dispose() { disposed = true; transport.cancel(); harness.dispose?.(); } };
}
