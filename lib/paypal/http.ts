import "server-only";
import { timingSafeEqual } from "node:crypto";
import { PayPalError } from "./client";

export function authorize(request: Request) {
  const secret = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
  if (!secret || secret.length < 32) throw new PayPalError(503, "Sandbox access is disabled.");
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new PayPalError(401, "Unauthorized.");
}
export function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function failure(error: unknown) {
  return reply({ error: error instanceof PayPalError ? error.message : "Sandbox request failed." }, error instanceof PayPalError ? error.status : 502);
}
