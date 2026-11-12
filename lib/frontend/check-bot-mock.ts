/** Scripted page-guide replies when AI chat is unavailable. */

export type CheckBotContext = {
  pathname: string;
  message: string;
  pageMarkdown: string;
};

function pageLabel(pathname: string) {
  if (pathname.startsWith("/studio")) return "AG Studio";
  if (pathname.startsWith("/audit")) return "the audit workspace";
  if (pathname === "/") return "the overview";
  return "this page";
}

function firstMatch(markdown: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

/** Build a grounded mock reply from the hidden page snapshot. No invented billing values. */
export function mockCheckBotReply({ pathname, message, pageMarkdown }: CheckBotContext): string {
  const page = pageLabel(pathname);
  const text = pageMarkdown.replace(/\s+/g, " ").trim();
  const ask = message.toLowerCase();
  const preview = "I'm the scripted PlanMirror page guide. Open Merchant Search, paste your pricing URL and select the corresponding sandbox plan to run an audit. I can quote this page but cannot run audits or retrieve billing data.";

  if (!text) {
    return `I'm on ${page}, but I couldn't read any page content just now. ${preview}`;
  }

  if (/mismatch|discrepan|differ|wrong/.test(ask)) {
    const snippet = firstMatch(text, [
      /((?:mismatch|discrepan)[^.?!]*[.?!])/i,
      /(23 fewer trial days[^.?!]*[.?!])/i,
    ]);
    return snippet
      ? `On ${page} I can see this about mismatches: “${snippet}” ${preview}`
      : `I'm reading ${page}. I don't see an explicit mismatch line in the current snapshot. ${preview}`;
  }

  if (/price|cost|usd|\$|month|billing|renewal/.test(ask)) {
    const snippet = firstMatch(text, [
      /(\d+\s+days free, then USD\s*\d+(?:\.\d+)?[^\n.!?]*)/i,
      /(USD\s*\d+(?:\.\d+)?(?:\s*per\s*month)?)/i,
      /(\$\d+(?:\.\d+)?(?:\s*per\s*month)?)/i,
    ]);
    return snippet
      ? `From ${page} I can cite: “${snippet}”. ${preview}`
      : `I'm reading ${page}. I couldn't find a clear price quote in the snapshot. ${preview}`;
  }

  if (/trial|free/.test(ask)) {
    const snippet = firstMatch(text, [
      /(\d+\s+days?\s+free(?:, then USD\s*\d+(?:\.\d+)?(?:\s*per\s*month)?)?)/i,
      /(free trial[^\n.!?]*)/i,
    ]);
    return snippet
      ? `From ${page}: “${snippet}”. ${preview}`
      : `I'm on ${page}. No clear trial wording showed up in this snapshot. ${preview}`;
  }

  if (/findings?|audit|studio|evidence/.test(ask)) {
    const hasFindings = /finding|mismatch|needs review|match/i.test(text);
    return hasFindings
      ? `I'm on ${page} and the snapshot includes audit/findings language. Ask me about a mismatch, trial, or price and I'll only quote what's on the page. ${preview}`
      : `I'm on ${page}. This snapshot doesn't show findings yet — try running an audit, then ask again. ${preview}`;
  }

  if (/who are you|what can you|help/.test(ask)) {
    return `I'm the PlanMirror check bot on ${page}. I quietly read the page (same agent snapshot as Markdown view) and answer from that context. ${preview}`;
  }

  const headline = firstMatch(text, [/^#\s+(.+)$/m, /Your promises[^.!]*/]);
  return headline
    ? `I'm looking at ${page}. Top signal from the page: “${headline}”. Ask about trials, prices, mismatches, or findings. ${preview}`
    : `I'm on ${page} with a page snapshot loaded. Ask about trials, prices, mismatches, or findings. ${preview}`;
}
