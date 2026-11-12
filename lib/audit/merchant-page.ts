import { parse, type DefaultTreeAdapterTypes } from "parse5";

const omittedTags = new Set(["script", "style", "template", "noscript", "svg", "head"]);
const blockTags = new Set(["article", "section", "div", "p", "li", "br", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6"]);

function visibleText(node: DefaultTreeAdapterTypes.Node): string {
  if ("value" in node && node.nodeName === "#text") return node.value;
  if ("tagName" in node && (omittedTags.has(node.tagName) ||
    node.attrs.some(({ name, value }) => name === "hidden" || (name === "aria-hidden" && value === "true")))) return "";
  if (!("childNodes" in node)) return "";
  const content = node.childNodes.map(visibleText).join("");
  return "tagName" in node && blockTags.has(node.tagName) ? `\n${content}\n` : content;
}

export function approvedMerchantPricingUrl(sourceUrl: string): URL | undefined {
  const url = URL.parse(sourceUrl);
  if (!url || url.protocol !== "https:" || url.username || url.password) return undefined;
  const allowed = (process.env.PLANMIRROR_MERCHANT_ORIGINS ?? "").split(",").map(origin => origin.trim());
  return allowed.includes(url.origin) ? url : undefined;
}

export async function readMerchantPricing(sourceUrl: string, fetchPage = fetch): Promise<string> {
  const url = approvedMerchantPricingUrl(sourceUrl);
  if (!url) throw new Error("Unsupported pricing page.");
  const response = await fetchPage(url, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(7000),
    headers: { Accept: "text/html, text/plain" },
  });
  const mime = response.headers.get("content-type")?.split(";")[0].trim();
  if (!response.ok || !response.body || (mime !== "text/html" && mime !== "text/plain")) {
    await response.body?.cancel();
    throw new Error("Pricing page unavailable.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) throw new Error("Pricing page is too large.");
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    await reader.cancel();
  }
  const sourceText = (mime === "text/html" ? visibleText(parse(body)) : body)
    .replace(/[^\S\n]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
  if (!sourceText || sourceText.length > 20_000) throw new Error("Pricing text is empty or too long.");
  return sourceText;
}
