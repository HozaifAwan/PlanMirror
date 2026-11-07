import { z } from "zod";
import { claimsSchema } from "./contracts";
import { planIdSchema } from "../paypal/normalize";

import { extractionSourceSchema } from "./extracted-audit";
import { JsonRequestError, readJsonRequest } from "../backend/json-request";

export { JsonRequestError as AuditRequestError };

export const auditRequestSchema = z.union([
  z.strictObject({ planId: planIdSchema, claims: claimsSchema }),
  z.strictObject({ planId: planIdSchema, source: extractionSourceSchema }),
]);

/** Bound the streamed body as well as validating JSON before invoking providers. */
export async function readAuditRequest(request: Request) {
  const body = await readJsonRequest(request);
  const parsed = auditRequestSchema.safeParse(body);
  if (!parsed.success) throw new JsonRequestError(400, "Audit request contains invalid plan or claim data.");
  return parsed.data;
}
