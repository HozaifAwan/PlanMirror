import "server-only";
import { PayPalError } from "./client";
import { RequestLimitError } from "../backend/request-limits";

export { authorize } from "../backend/authorize";
export function reply(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}
export function failure(error: unknown) {
  if (error instanceof RequestLimitError) return reply({ error: error.message }, 429, { "Retry-After": String(error.retryAfter) });
  return reply({ error: error instanceof PayPalError ? error.message : "Sandbox request failed." }, error instanceof PayPalError ? error.status : 502);
}
