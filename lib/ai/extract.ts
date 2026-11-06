import { extractionResponseSchema, type ExtractionResponse } from "./schema";

const endpoint = "https://api.openai.com/v1/responses";
const model = "gpt-4o-mini";
const outputSchema = { type: "object", additionalProperties: false, required: ["status", "claims", "reason"], properties: { status: { type: "string", enum: ["ok", "needs_review"] }, claims: { type: "array", items: { type: "object", additionalProperties: true } }, reason: { type: ["string", "null"] } } };

export type ExtractOffersInput = { sourceText: string; sourceUrl: string; apiKey?: string; fetcher?: typeof fetch };

export async function extractOffers({ sourceText, sourceUrl, apiKey = process.env.OPENAI_API_KEY, fetcher = fetch }: ExtractOffersInput): Promise<ExtractionResponse> {
  if (!sourceText.trim()) return { status: "needs_review", claims: [], reason: "The source contains no extractable text." };
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetcher(endpoint, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "system", content: "Extract only subscription terms explicitly supported by the supplied source. Use exact contiguous quotes from the source. If terms are ambiguous, incomplete, unsupported, or cannot be quoted exactly, return needs_review." }, { role: "user", content: `Source URL: ${sourceUrl}\n\nSource text:\n${sourceText}` }], text: { format: { type: "json_schema", name: "planmirror_offer_extraction", strict: true, schema: outputSchema } } }) });
  if (!response.ok) throw new Error(`OpenAI extraction failed with status ${response.status}.`);
  const body = await response.json() as { output_text?: unknown };
  if (typeof body.output_text !== "string") throw new Error("OpenAI returned no structured extraction.");
  let parsed: unknown;
  try { parsed = JSON.parse(body.output_text); } catch { throw new Error("OpenAI returned malformed extraction JSON."); }
  const result = extractionResponseSchema.safeParse(parsed);
  if (!result.success) throw new Error("OpenAI returned an invalid extraction shape.");
  if (result.data.status === "ok") for (const claim of result.data.claims) if (claim.evidence.url !== sourceUrl || !sourceText.includes(claim.evidence.quote)) return { status: "needs_review", claims: [], reason: "One or more extracted quotes could not be verified against the source." };
  return result.data;
}
