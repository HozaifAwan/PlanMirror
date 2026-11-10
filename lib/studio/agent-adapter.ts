import type { AgAiEvent, AgLlmAdapter, AgLlmResponse, AgLlmResponseHandler } from "ag-studio";
import type { StudioRun } from "./types";
/** One server-issued budget is shared by every delegate within a top-level exchange. */
export function createStudioAdapter(run: StudioRun) {
  let budget: Promise<string> | undefined;
  let requestController = new AbortController();
  const base = { runId: run.id, source: run.source };
  async function post(body: unknown, signal: AbortSignal) {
    const response = await fetch("/api/ai/studio-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? "Auditor unavailable."); }
    return response;
  }
  const adapter: AgLlmAdapter = {
    executeTurn(request, options): AgLlmResponseHandler {
      const events: AgAiEvent[] = []; let wake: (() => void) | undefined; let done = false; let failure: unknown;
      const signal = AbortSignal.any([requestController.signal, ...(options?.signal ? [options.signal] : [])]);
      const complete = (async (): Promise<AgLlmResponse> => {
        try {
          budget ??= post(base, signal).then(response => response.json()).then(result => result.budgetId as string);
          const response = await post({ ...base, budgetId: await budget, agentId: options?.trace?.agentId ?? "auditor", request: { input: request.input.filter(item => item.type !== "reasoning"), instructions: request.instructions, tools: request.tools, toolChoice: request.toolChoice, responseFormat: request.responseFormat } }, signal);
          const reader = response.body!.getReader(); const decoder = new TextDecoder(); let buffer = ""; let result: AgLlmResponse | undefined;
          try {
            while (true) {
              const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
              let newline;
              while ((newline = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1); if (!line) continue;
                const record = JSON.parse(line);
                if (record.error) throw new Error(record.error);
                if (record.event) { events.push(record.event); wake?.(); }
                if (record.complete) result = record.complete;
              }
              if (chunk.done) break;
            }
          } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
          signal.throwIfAborted();
          if (!result) throw new Error("Auditor connection ended early.");
          return result;
        } catch (error) { failure = error; throw error; }
        finally { done = true; wake?.(); }
      })();
      // Both consumers receive errors, without an unhandled rejection while the stream is read.
      void complete.catch(() => {});
      return { complete, stream: { async *[Symbol.asyncIterator]() {
        while (!done || events.length) {
          if (events.length) yield events.shift()!;
          else await new Promise<void>(resolve => { wake = resolve; });
        }
        if (failure) throw failure;
      } } };
    },
  };
  return { adapter, begin() { requestController.abort(); requestController = new AbortController(); budget = undefined; }, cancel() { requestController.abort(); } };
}
