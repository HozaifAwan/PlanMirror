import { extractionResponseSchema, type ExtractionResponse } from "./schema";

const endpoint = "https://api.openai.com/v1/responses";
const model = "gpt-4o-mini";
const money = { type: "object", additionalProperties: false, required: ["value", "currencyCode"], properties: { value: { type: "string", pattern: "^[0-9]+(\\.[0-9]+)?$" }, currencyCode: { type: "string", pattern: "^[A-Z]{3}$" } } };
const interval = { type: "object", additionalProperties: false, required: ["unit", "count"], properties: { unit: { type: "string", enum: ["DAY", "WEEK", "MONTH", "YEAR"] }, count: { type: "integer", minimum: 1 } } };
const evidence = { type: "object", additionalProperties: false, required: ["url", "quote"], properties: { url: { type: "string", format: "uri" }, quote: { type: "string", minLength: 1 } } };
const claimBase = { offerLabel: { type: "string", minLength: 1 }, evidence };
const nullableMoney = { anyOf: [money, { type: "null" }] };
const outputSchema = { type: "object", additionalProperties: false, required: ["status", "claims", "reason"], properties: { status: { type: "string", enum: ["ok", "needs_review"] }, claims: { type: "array", items: { anyOf: [
  { type: "object", additionalProperties: false, required: ["field", "offerLabel", "evidence", "duration", "price"], properties: { ...claimBase, field: { const: "trial" }, duration: interval, price: { anyOf: [money, { type: "null" }] } } },
  { type: "object", additionalProperties: false, required: ["field", "offerLabel", "evidence", "price", "quotedInterval", "billedInterval"], properties: { ...claimBase, field: { const: "recurring_price" }, price: nullableMoney, quotedInterval: interval, billedInterval: { anyOf: [interval, { type: "null" }] } } },
  { type: "object", additionalProperties: false, required: ["field", "offerLabel", "evidence", "interval"], properties: { ...claimBase, field: { const: "billing_interval" }, interval } },
  { type: "object", additionalProperties: false, required: ["field", "offerLabel", "evidence", "price"], properties: { ...claimBase, field: { const: "setup_fee" }, price: nullableMoney } },
] } }, reason: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] } } };

export type ExtractOffersInput = { sourceText: string; sourceUrl: string; apiKey?: string; fetcher?: typeof fetch };

export function parseResponsesText(body: unknown): string {
  if (!body || typeof body !== "object") throw new Error("OpenAI returned an invalid response.");
  const value = body as { status?: unknown; output?: unknown };
  if (value.status !== "completed") throw new Error("OpenAI returned an incomplete extraction.");
  if (!Array.isArray(value.output)) throw new Error("OpenAI returned no structured extraction.");
  const text = value.output.flatMap(item => {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") return [];
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    if (content.some(part => part?.type === "refusal")) throw new Error("OpenAI returned a refusal.");
    return content.flatMap(part => part && typeof part === "object" && (part as { type?: unknown }).type === "output_text" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : []);
  }).join("");
  if (!text) throw new Error("OpenAI returned no structured extraction.");
  return text;
}

export async function extractOffers({ sourceText, sourceUrl, apiKey = process.env.OPENAI_API_KEY, fetcher = fetch }: ExtractOffersInput): Promise<ExtractionResponse> {
  if (!sourceText.trim()) return { status: "needs_review", claims: [], reason: "The source contains no extractable text." };
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  let response: Response;
  try {
    // The native fetch signal also bounds reading the response body.
    response = await fetcher(endpoint, { method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "system", content: "Extract only subscription terms explicitly supported by the supplied source. Use exact contiguous quotes from the source. If terms are ambiguous, incomplete, unsupported, or cannot be quoted exactly, return needs_review." }, { role: "user", content: `Source URL: ${sourceUrl}\n\nSource text:\n${sourceText}` }], text: { format: { type: "json_schema", name: "planmirror_offer_extraction", strict: true, schema: outputSchema } } }) });
  } catch {
    throw new Error("OpenAI extraction request failed.");
  }
  if (!response.ok) throw new Error(`OpenAI extraction failed with status ${response.status}.`);
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("OpenAI extraction response could not be read."); }
  let parsed: unknown;
  try { parsed = JSON.parse(parseResponsesText(body)); } catch (error) { if (error instanceof Error && error.message.startsWith("OpenAI returned")) throw error; throw new Error("OpenAI returned malformed extraction JSON."); }
  const result = extractionResponseSchema.safeParse(parsed);
  if (!result.success) throw new Error("OpenAI returned an invalid extraction shape.");
  if (result.data.status === "ok") for (const claim of result.data.claims) if (claim.evidence.url !== sourceUrl || !sourceText.includes(claim.evidence.quote)) return { status: "needs_review", claims: [], reason: "One or more extracted quotes could not be verified against the source." };
  if (result.data.status === "needs_review") {
    return { status: "needs_review", claims: [], reason: "The source requires manual review." };
  }
  const claims: Extract<ExtractionResponse, { status: "ok" }>["claims"] = [];
  for (const claim of result.data.claims) {
    if (claim.field === "trial") {
      const { price, ...trial } = claim;
      claims.push(price === null ? trial : { ...trial, price });
    } else if (claim.field === "recurring_price") {
      const { billedInterval, price, ...recurring } = claim;
      if (price === null) return { status: "needs_review", claims: [], reason: "The recurring price is unclear." };
      claims.push(billedInterval === null ? { ...recurring, price } : { ...recurring, price, billedInterval });
    } else if (claim.field === "setup_fee") {
      if (claim.price === null) return { status: "needs_review", claims: [], reason: "The setup fee is unclear." };
      claims.push({ ...claim, price: claim.price });
    } else {
      claims.push(claim);
    }
  }
  return { status: "ok", claims };
}
