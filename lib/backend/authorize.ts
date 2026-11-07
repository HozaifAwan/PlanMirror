import { timingSafeEqual } from "node:crypto";
import { PayPalError } from "../paypal/client";
import { requestLimits } from "./request-limits";

/** Controlled single-merchant demo gate. Never include its value in browser code or URLs. */
export function authorize(request: Request) {
  const secret = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
  if (!secret || secret.length < 32) throw new PayPalError(503, "Sandbox access is disabled.");
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new PayPalError(401, "Unauthorized.");
  requestLimits.checkRequest();
}
