"use server";

import { answerCheckBot, type CheckBotResult } from "../../lib/ai/check-bot";
import { createRequestLimits, RequestLimitError } from "../../lib/backend/request-limits";

// Separate chat budget so conversation cannot exhaust the audit's provider budget.
// Next Server Actions enforce same-origin requests. Limits are process-local for this demo.
const shared = globalThis as typeof globalThis & { __planmirrorChatLimits?: Parameters<typeof createRequestLimits>[1] };
const now = Date.now();
const limits = createRequestLimits(Date.now, shared.__planmirrorChatLimits ??= {
  requests: { start: now, count: 0 }, providers: { start: now, count: 0 }, active: 0,
});

export async function askCheckBot(input: unknown): Promise<CheckBotResult> {
  try {
    limits.checkRequest();
    return await limits.runProviderWork(() => answerCheckBot(input, {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.PLANMIRROR_CHAT_MODEL,
    }));
  } catch (error) {
    return { ok: false, error: error instanceof RequestLimitError
      ? `Chat is busy. Try again in ${error.retryAfter} seconds.`
      : "AI chat is unavailable. Please try again." };
  }
}
