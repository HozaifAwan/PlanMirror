import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { extractOffers } from "../../../../lib/ai/extract";

export const runtime = "nodejs";

const requestSchema = z.object({ sourceText: z.string().trim().min(1).max(100_000), sourceUrl: z.string().url() });

function authorize(request: Request) {
  const secret = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
  if (!secret || secret.length < 32) throw new Error("Sandbox access is disabled.");
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Unauthorized.");
}

export async function POST(request: Request) {
  try {
    authorize(request);
    const reader = request.body?.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let json = "";
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 400_000) {
          await reader.cancel();
          return Response.json({ error: "Request body is too large." }, { status: 413 });
        }
        json += decoder.decode(value, { stream: true });
      }
    }
    let input: unknown;
    try {
      input = JSON.parse(json + decoder.decode());
    } catch {
      return Response.json({ error: "Invalid JSON." }, { status: 400 });
    }
    const body = requestSchema.safeParse(input);
    if (!body.success) return Response.json({ error: "Provide a valid sourceUrl and sourceText." }, { status: 400 });
    return Response.json(await extractOffers(body.data), { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI extraction failed.";
    const status = message === "Unauthorized." ? 401 : message.includes("access is disabled") || message.includes("OPENAI_API_KEY") ? 503 : 502;
    const safeMessage = status === 401 ? "Unauthorized." : status === 503 ? "Extraction is unavailable." : "AI extraction failed.";
    return Response.json({ error: safeMessage }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
