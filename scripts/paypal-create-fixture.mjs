// Explicit local-only provisioning; never exposed by a web endpoint.
// node --env-file=.env.local scripts/paypal-create-fixture.mjs
import { appendFileSync } from 'node:fs';
import { createSandboxClient } from '../lib/paypal/client.ts';
const origin = 'https://api-m.sandbox.paypal.com';
const config = { clientId: process.env.PAYPAL_CLIENT_ID ?? '', clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '', environment: process.env.PAYPAL_ENVIRONMENT ?? 'sandbox' };
async function call(path, init = {}) {
  let response;
  try { response = await fetch(origin + path, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
  catch { throw Error('Cannot reach PayPal sandbox.'); }
  if (!response.ok) throw Error(`Sandbox provisioning failed (HTTP ${response.status}); no upstream body logged.`);
  return response.json();
}
try {
  if (config.environment !== 'sandbox' || !config.clientId || !config.clientSecret) throw Error('Sandbox credentials are required.');
  const client = createSandboxClient(config);
  let page = 1, existing;
  do {
    const list = await client.listPlans(page);
    existing = list.plans.find(p => p.name === 'Quillfox Pro' && p.billingCycles.length === 2 &&
      p.billingCycles[0].tenure === 'TRIAL' && p.billingCycles[0].interval.unit === 'DAY' && p.billingCycles[0].interval.count === 7 && p.billingCycles[0].totalCycles === 1 && Number(p.billingCycles[0].fixedPrice?.value) === 0 && p.billingCycles[0].fixedPrice?.currencyCode === 'USD' &&
      p.billingCycles[1].tenure === 'REGULAR' && p.billingCycles[1].interval.unit === 'MONTH' && p.billingCycles[1].interval.count === 1 && p.billingCycles[1].totalCycles === 0 && p.billingCycles[1].fixedPrice?.value === '9.99' && p.billingCycles[1].fixedPrice?.currencyCode === 'USD');
    if (existing || !list.nextPage) break;
    page = list.nextPage;
    if (page > 100) throw Error('Too many plans; inspect manually.');
  } while (true);
  let productId = existing?.productId, planId = existing?.id;
  if (!existing) {
    const auth = await call('/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const headers = { Authorization: 'Bearer ' + auth.access_token, 'Content-Type': 'application/json' };
    let productPage = 1;
    do {
      const products = await call(`/v1/catalogs/products?page=${productPage}&page_size=20&total_required=true`, { headers });
      productId = products.products?.find(p => p.name === 'Quillfox Pro')?.id;
      if (productId || productPage >= products.total_pages || !products.products?.length) break;
      if (++productPage > 100) throw Error('Too many products; inspect manually.');
    } while (true);
    if (!productId) {
      const product = await call('/v1/catalogs/products', { method: 'POST', headers: { ...headers, 'PayPal-Request-Id': 'planmirror-quillfox-product-v1' }, body: JSON.stringify({ name: 'Quillfox Pro', description: 'PlanMirror sandbox audit fixture', type: 'SERVICE', category: 'SOFTWARE' }) });
      productId = product.id;
    }
    const plan = await call('/v1/billing/plans', { method: 'POST', headers: { ...headers, 'PayPal-Request-Id': 'planmirror-quillfox-plan-v1' }, body: JSON.stringify({ product_id: productId, name: 'Quillfox Pro', status: 'ACTIVE', description: 'Sandbox fixture: seven-day free trial then USD 9.99 monthly',
      billing_cycles: [
        { frequency: { interval_unit: 'DAY', interval_count: 7 }, tenure_type: 'TRIAL', sequence: 1, total_cycles: 1, pricing_scheme: { fixed_price: { value: '0', currency_code: 'USD' } } },
        { frequency: { interval_unit: 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 2, total_cycles: 0, pricing_scheme: { fixed_price: { value: '9.99', currency_code: 'USD' } } },
      ], payment_preferences: { auto_bill_outstanding: true, setup_fee: { value: '0', currency_code: 'USD' }, setup_fee_failure_action: 'CANCEL', payment_failure_threshold: 3 },
    }) });
    planId = plan.id;
  }
  const verified = await client.readPlan(planId);
  if (process.env.PAYPAL_SANDBOX_PLAN_ID !== planId) appendFileSync('.env.local', '\nPAYPAL_SANDBOX_PLAN_ID=' + planId + '\n');
  console.log(JSON.stringify({ result: existing ? 'Reused sandbox fixture' : 'Created sandbox fixture', productId, planId, billingCycles: verified.billingCycles }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
