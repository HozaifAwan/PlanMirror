import { z } from "zod";
import { claimsSchema } from "./contracts";
import { planIdSchema } from "../paypal/normalize";

export const auditRequestSchema = z.strictObject({ planId: planIdSchema, claims: claimsSchema });
const maximumBytes = 32 * 1024;

export class AuditRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Bound the streamed body as well as validating JSON before invoking providers. */
export async function readAuditRequest(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new AuditRequestError(415, "Send an application/json request.");
  }
  if (!request.body) throw new AuditRequestError(400, "Audit request body is missing.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new AuditRequestError(413, "Audit request exceeds 32 KiB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AuditRequestError(400, "Audit request must contain valid JSON.");
  }
  const parsed = auditRequestSchema.safeParse(body);
  if (!parsed.success) throw new AuditRequestError(400, "Audit request contains invalid plan or claim data.");
  return parsed.data;
}
