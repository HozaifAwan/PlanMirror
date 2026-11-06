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
    const body = requestSchema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "Provide a valid sourceUrl and sourceText." }, { status: 400 });
    return Response.json(await extractOffers(body.data), { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI extraction failed.";
    const status = message === "Unauthorized." ? 401 : message.includes("access is disabled") || message.includes("OPENAI_API_KEY") ? 503 : 502;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
