export class JsonRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/** Bound bytes and upload time before parsing or invoking any provider. */
export async function readJsonRequest(request: Request, timeoutMs = 5_000): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new JsonRequestError(415, "Send an application/json request.");
  }
  if (!request.body) throw new JsonRequestError(400, "Request body is missing.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(new JsonRequestError(400, "Request was interrupted."));
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    timer = setTimeout(() => reject(new JsonRequestError(408, "Request body took too long.")), timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 32 * 1024) throw new JsonRequestError(413, "Request exceeds 32 KiB.");
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new JsonRequestError(400, "Request must contain valid JSON."); }
  } catch (error) {
    // Do not wait on an untrusted stream's cancellation implementation.
    void reader.cancel().catch(() => {});
    if (error instanceof JsonRequestError) throw error;
    throw new JsonRequestError(400, "Request body could not be read.");
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
