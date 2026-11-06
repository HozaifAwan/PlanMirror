import { z } from "zod";
import { extractOffers } from "../../../../lib/ai/extract";
import { authorize } from "../../../../lib/backend/authorize";
import { JsonRequestError, readJsonRequest } from "../../../../lib/backend/json-request";
import { RequestLimitError, requestLimits } from "../../../../lib/backend/request-limits";
import { PayPalError } from "../../../../lib/paypal/client";

export const runtime = "nodejs";

const requestSchema = z.strictObject({
  sourceText: z.string().min(1).max(20_000).refine(value => value.trim().length > 0),
  sourceUrl: z.url().refine(value => /^https?:\/\//i.test(value)),
});

function reply(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}

export async function POST(request: Request) {
  try {
    authorize(request);
    const body = requestSchema.safeParse(await readJsonRequest(request));
    if (!body.success) return reply({ error: "Provide a valid sourceUrl and sourceText." }, 400);
    return reply(await requestLimits.runProviderWork(() => extractOffers(body.data)));
  } catch (error) {
    if (error instanceof JsonRequestError) return reply({ error: error.message }, error.status);
    if (error instanceof RequestLimitError) return reply({ error: error.message }, 429, { "Retry-After": String(error.retryAfter) });
    const status = error instanceof PayPalError ? error.status :
      error instanceof Error && error.message === "OPENAI_API_KEY is not configured." ? 503 : 502;
    return reply({ error: status === 401 ? "Unauthorized." : status === 503 ? "Extraction is unavailable." : "AI extraction failed." }, status);
  }
}
