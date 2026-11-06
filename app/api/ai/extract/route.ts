import { z } from "zod";
import { extractOffers } from "../../../../lib/ai/extract";

export const runtime = "nodejs";

const requestSchema = z.object({ sourceText: z.string().trim().min(1).max(100_000), sourceUrl: z.string().url() });

export async function POST(request: Request) {
  try {
    const body = requestSchema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "Provide a valid sourceUrl and sourceText." }, { status: 400 });
    return Response.json(await extractOffers(body.data), { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI extraction failed.";
    return Response.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 502, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
