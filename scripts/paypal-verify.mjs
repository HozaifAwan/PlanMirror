// Run with: node --env-file=.env.local scripts/paypal-verify.mjs
// Prints only safe summaries; never credentials, access tokens or upstream error bodies.
import { createSandboxClient } from '../lib/paypal/client.ts';
const client = createSandboxClient({ clientId: process.env.PAYPAL_CLIENT_ID ?? '', clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '', environment: process.env.PAYPAL_ENVIRONMENT });
try {
  let page = 1;
  let count = 0;
  let selected;
  do {
    const result = await client.listPlans(page);
    count += result.plans.length;
    selected ??= result.plans.find(p => p.name === 'Quillfox Pro');
    if (!result.nextPage) break;
    page = result.nextPage;
    if (page > 100) throw Error('Too many pages; select a plan ID explicitly.');
  } while (true);
  console.log('PASS: sandbox OAuth and plan listing;', count, 'plans.');
  const id = process.env.PAYPAL_SANDBOX_PLAN_ID || selected?.id;
  if (id) {
    const plan = await client.readPlan(id);
    console.log(JSON.stringify({ result: 'PASS: real sandbox retrieval', id: plan.id, retrievedAt: plan.retrievedAt, billingCycles: plan.billingCycles }));
  } else console.log('No Quillfox Pro plan found. Create a sandbox plan and set PAYPAL_SANDBOX_PLAN_ID.');
} catch (error) { console.error(error instanceof Error && error.name === 'Error' ? error.message : 'Sandbox verification failed.'); process.exitCode = 1; }
