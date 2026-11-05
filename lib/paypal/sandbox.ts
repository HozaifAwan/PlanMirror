import "server-only";
import { createSandboxClient } from "./client";

let client: ReturnType<typeof createSandboxClient> | undefined;
let key = "";
export function sandboxClient() {
  const config = { clientId: process.env.PAYPAL_CLIENT_ID ?? "", clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "", environment: process.env.PAYPAL_ENVIRONMENT ?? "sandbox" };
  const nextKey = JSON.stringify(config);
  if (!client || key !== nextKey) { client = createSandboxClient(config); key = nextKey; }
  return client;
}
/** Integration contract for the comparison engineer; call only from authorized server code. */
export const readSandboxPlan = (id: string) => sandboxClient().readPlan(id);
