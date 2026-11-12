import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { Resolver } from "node:dns/promises";
import { get } from "node:https";
import { BlockList, isIP } from "node:net";
import { Readable } from "node:stream";

const reserved = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) reserved.addSubnet(address, prefix);

async function fetchPublicPage(url: URL, init: RequestInit): Promise<Response> {
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  const addresses = await resolver.resolve4(url.hostname);
  if (!addresses.length || addresses.some(address => reserved.check(address))) {
    throw new Error("Pricing page must resolve to a public address.");
  }
  // Connect to the checked address and preserve the original hostname for TLS.
  return new Promise((resolve, reject) => {
    const request = get(url, {
      hostname: addresses[0], servername: url.hostname, agent: false,
      signal: init.signal ?? undefined,
      headers: { Host: url.host, Accept: "text/html, text/plain", "Accept-Encoding": "identity" },
    }, response => {
      const status = response.statusCode ?? 502;
      if (status < 200 || status >= 300 || status === 204 || status === 205) {
        response.destroy();
        reject(new Error("Pricing page unavailable."));
        return;
      }
      resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, {
        status, headers: { "content-type": response.headers["content-type"] ?? "" },
      }));
    });
    request.on("error", reject);
  });
}

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

export async function readMerchantPricing(sourceUrl: string, fetchPage = fetchPublicPage): Promise<string> {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
    !url.hostname.includes(".") || isIP(url.hostname)) {
    throw new Error("Unsupported pricing page.");
  }
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
