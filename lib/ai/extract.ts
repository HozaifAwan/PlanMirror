import { extractionResponseSchema, type ExtractionResponse } from "./schema";

const endpoint = "https://api.openai.com/v1/responses";
const model = "gpt-4o-mini";
const money = { type: "object", additionalProperties: false, required: ["value", "currencyCode"], properties: { value: { type: "string", pattern: "^[0-9]+(\\.[0-9]+)?$" }, currencyCode: { type: "string", pattern: "^[A-Z]{3}$" } } };
const interval = { type: "object", additionalProperties: false, required: ["unit", "count"], properties: { unit: { type: "string", enum: ["DAY", "WEEK", "MONTH", "YEAR"] }, count: { type: "integer", minimum: 1 } } };
const evidence = { type: "object", additionalProperties: false, required: ["url", "quote"], properties: { url: { type: "string", format: "uri" }, quote: { type: "string", minLength: 1 } } };
const claimBase = { offerLabel: { type: "string", minLength: 1 }, evidence };
const outputSchema = { type: "object", additionalProperties: false, required: ["status", "claims", "reason"], properties: { status: { type: "string", enum: ["ok", "needs_review"] }, claims: { type: "array", items: { anyOf: [
  { type: "object", additionalProperties: false, required: ["field", "offerLabel", "evidence", "duration", "price"], properties: { ...claimBase, field: { const: "trial" }, duration: interval, price: { anyOf: [money, { type: "null" }] } } },
  { type: "object", additionalProperties: false, required: ["field", "offerLabel", "evidence", "price", "quotedInterval", "billedInterval"], properties: { ...claimBase, field: { const: "recurring_price" }, price: money, quotedInterval: interval, billedInterval: { anyOf: [interval, { type: "null" }] } } },
  { type: "object", additionalProperties: false, required: ["field", "offerLabel", "evidence", "interval"], properties: { ...claimBase, field: { const: "billing_interval" }, interval } },
  { type: "object", additionalProperties: false, required: ["field", "offerLabel", "evidence", "price"], properties: { ...claimBase, field: { const: "setup_fee" }, price: money } },
] } }, reason: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] } } };

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
