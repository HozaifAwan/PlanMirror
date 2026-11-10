import { mintBudget, streamAgentTurn, StudioAgentError, validateEnvelope } from "../../../../lib/ai/studio-agent";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new StudioAgentError(403, "Open Ask Auditor from this website.");
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new StudioAgentError(415, "JSON required.");
    if (!process.env.OPENAI_API_KEY) throw new StudioAgentError(503, "Configure OPENAI_API_KEY on the server to enable Ask Auditor.");
    const reader = request.body?.getReader();
    if (!reader) throw new StudioAgentError(400, "Missing request.");
    const decoder = new TextDecoder(); let text = ""; let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 256 * 1024) { await reader.cancel(); throw new StudioAgentError(413, "Conversation too large. Start a new Auditor thread."); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new StudioAgentError(400, "Invalid JSON."); }
    const body = validateEnvelope(raw);
    if (!body.request) return Response.json(mintBudget(body.runId, body.source), { headers });
    const encoder = new TextEncoder(); const controller = new AbortController();
    const signal = AbortSignal.any([request.signal, controller.signal]);
    const stream = new ReadableStream({
      async start(output) {
        try { await streamAgentTurn(body, signal, record => { if (!signal.aborted) output.enqueue(encoder.encode(`${JSON.stringify(record)}\n`)); }); }
        catch (error) { if (!signal.aborted) output.enqueue(encoder.encode(`${JSON.stringify({ error: error instanceof StudioAgentError ? error.message : "Auditor could not complete the request. Earlier dashboard changes may remain." })}\n`)); }
        finally { if (!signal.aborted) output.close(); }
      },
      cancel() { controller.abort(); },
    });
    return new Response(stream, { headers: { ...headers, "Content-Type": "application/x-ndjson" } });
  } catch (error) {
    return Response.json({ error: error instanceof StudioAgentError ? error.message : "Auditor request failed." }, { status: error instanceof StudioAgentError ? error.status : 500, headers });
  }
}
