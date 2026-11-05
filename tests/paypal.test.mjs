import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxClient, PayPalError } from '../lib/paypal/client.ts';
import { normalizePlan } from '../lib/paypal/normalize.ts';

const config = { clientId: 'mock-client', clientSecret: 'mock-secret' };
const fixture = () => ({ id: 'P-TEST123', product_id: 'PROD-TEST', name: 'Quillfox Pro', status: 'ACTIVE',
  billing_cycles: [
    { sequence: 1, tenure_type: 'TRIAL', total_cycles: 1, frequency: { interval_unit: 'DAY', interval_count: 7 }, pricing_scheme: { fixed_price: { value: '0.00', currency_code: 'USD' } } },
    { sequence: 2, tenure_type: 'REGULAR', total_cycles: 0, frequency: { interval_unit: 'MONTH', interval_count: 1 }, pricing_scheme: { fixed_price: { value: '9.99', currency_code: 'USD' } } },
  ], payment_preferences: { setup_fee: { value: '0', currency_code: 'USD' } } });
const response = (body, status = 200) => Response.json(body, { status });
const token = () => response({ access_token: 'mock-token', expires_in: 3600 });

test('preserves seven-day trial, exact money, monthly cadence, setup fee and source', () => {
  const p = normalizePlan(fixture());
  assert.deepEqual(p.billingCycles[0].interval, { unit: 'DAY', count: 7 });
  assert.deepEqual(p.billingCycles[1].fixedPrice, { value: '9.99', currencyCode: 'USD' });
  assert.deepEqual(p.billingCycles[1].interval, { unit: 'MONTH', count: 1 });
  assert.equal(p.setupFee.value, '0');
  assert.deepEqual(p.source, fixture());
});
test('two trials, annual cadence and missing fixed prices remain explicit', () => {
  const p = fixture();
  p.billing_cycles.splice(1, 0, { ...p.billing_cycles[0], sequence: 2 });
  p.billing_cycles[2].sequence = 3;
  p.billing_cycles[2].frequency = { interval_unit: 'YEAR', interval_count: 1 };
  delete p.billing_cycles[2].pricing_scheme;
  assert.equal(normalizePlan(p).billingCycles[2].fixedPrice, undefined);
});
test('rejects malformed money and duplicate cycle sequences', () => {
  const p = fixture(); p.billing_cycles[1].sequence = 1;
  assert.throws(() => normalizePlan(p));
  const q = fixture(); q.billing_cycles[1].pricing_scheme.fixed_price.value = 'NaN';
  assert.throws(() => normalizePlan(q));
});
test('shares concurrent OAuth requests, reads detailed plans and preserves no-store', async () => {
  let auth = 0;
  const client = createSandboxClient(config, async (url, options) => {
    assert.equal(options.cache, 'no-store');
    if (url.endsWith('/token')) { auth++; return token(); }
    return response(fixture());
  });
  await Promise.all([client.readPlan('P-TEST123'), client.readPlan('P-TEST123')]);
  assert.equal(auth, 1);
});
test('refreshes rejected token once', async () => {
  let auth = 0, reads = 0;
  const client = createSandboxClient(config, async url => {
    if (url.endsWith('/token')) { auth++; return token(); }
    return ++reads === 1 ? response({}, 401) : response(fixture());
  });
  await client.readPlan('P-TEST123'); assert.equal(auth, 2); assert.equal(reads, 2);
});
test('expires tokens before reuse', async () => {
  let auth = 0;
  const client = createSandboxClient(config, async url => url.endsWith('/token') ? (auth++, response({ access_token: 'test', expires_in: 0.001 })) : response(fixture()));
  await client.readPlan('P-TEST123'); await new Promise(r => setTimeout(r, 5)); await client.readPlan('P-TEST123');
  assert.equal(auth, 2);
});
test('pagination returns next page and retrieves individual details', async () => {
  const urls = [];
  const client = createSandboxClient(config, async (url, options) => {
    urls.push(url);
    if (url.endsWith('/token')) return token();
    assert.equal(options.headers.Prefer, 'return=representation');
    if (url.includes('?')) return response({ plans: [{ id: 'P-TEST123' }], total_items: 2, total_pages: 2 });
    return response(fixture());
  });
  const result = await client.listPlans(1, 1);
  assert.equal(result.nextPage, 2); assert.equal(result.plans[0].id, 'P-TEST123');
  assert.equal(urls.length, 3);
});
test('invalid IDs and pagination make no upstream requests', async () => {
  const client = createSandboxClient(config, async () => { throw Error('must not fetch'); });
  await assert.rejects(client.readPlan('../token'), { status: 400 });
  await assert.rejects(client.listPlans(0), { status: 400 });
});
test('safe errors for invalid credentials, network failure, missing plans and malformed responses', async () => {
  for (const [fetcher, status] of [
    [async () => response({ secret: 'DO-NOT-LEAK' }, 401), 502],
    [async () => { throw Error('DO-NOT-LEAK'); }, 502],
    [async url => url.endsWith('/token') ? token() : response({}, 404), 404],
    [async url => url.endsWith('/token') ? token() : response({}), 502],
  ]) {
    await assert.rejects(createSandboxClient(config, fetcher).readPlan('P-TEST123'), e => e instanceof PayPalError && e.status === status && !e.message.includes('DO-NOT-LEAK'));
  }
  await assert.rejects(createSandboxClient({ ...config, environment: 'live' }).readPlan('P-TEST123'), { status: 503 });
});
