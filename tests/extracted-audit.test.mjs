import test from 'node:test';
import assert from 'node:assert/strict';
import { createExtractedPlanAudit, extractedCandidates } from '../lib/orchestration/extracted-audit.ts';
import { createPlanAudit } from '../lib/orchestration/plan-audit.ts';
import { createSandboxClient } from '../lib/paypal/client.ts';
import { extractOffers } from '../lib/ai/extract.ts';
import { readAuditRequest } from '../lib/orchestration/audit-request.ts';

const source = { sourceUrl: 'https://example.com/pricing', sourceText: '  Pro: 30 days free. Then USD 9.99/month.\n', offerLabel: 'Pro' };
const claim = { field: 'trial', offerLabel: 'Pro', duration: { unit: 'DAY', count: 30 }, evidence: { url: source.sourceUrl, quote: '  Pro: 30 days free.' } };
const plan = { id: 'P-TEST', productId: 'PROD-TEST', name: 'Pro', status: 'ACTIVE', retrievedAt: '2026-11-05T12:00:00Z', billingCycles: [{ sequence: 1, tenure: 'REGULAR', totalCycles: 0, interval: { unit: 'MONTH', count: 1 }, fixedPrice: { value: '9.99', currencyCode: 'USD' } }] };
const makeAudit = extract => createExtractedPlanAudit(createPlanAudit(async () => structuredClone(plan)), extract);

test('adapter assigns repeatable unique IDs, selects one offer and preserves exact evidence', () => {
  const data = { status: 'ok', claims: [claim, claim, { ...claim, offerLabel: 'Other' }] };
  const a = extractedCandidates(source, data);
  assert.deepEqual(a, extractedCandidates(source, data));
  assert.equal(a.length, 2);
  assert.notEqual(a[0].id, a[1].id);
  assert.deepEqual(a[0].claim.evidence, claim.evidence);
});

test('real extractor and PayPal normalizer flow through adapter using controlled transport', async () => {
  let oauth = 0, extraction = 0;
  const client = createSandboxClient({ clientId: 'fixture', clientSecret: 'fixture' }, async url => {
    if (String(url).endsWith('/token')) { oauth++; return Response.json({ access_token: 'fixture', expires_in: 3600 }); }
    return Response.json({ id: plan.id, product_id: plan.productId, name: plan.name, status: 'ACTIVE', billing_cycles: [{ sequence: 1, tenure_type: 'REGULAR', total_cycles: 0, frequency: { interval_unit: 'MONTH', interval_count: 1 }, pricing_scheme: { fixed_price: { value: '9.99', currency_code: 'USD' } } }] });
  });
  const audit = createExtractedPlanAudit(createPlanAudit(client.readPlan), input => extractOffers({ ...input, apiKey: 'fixture', fetcher: async () => {
    extraction++;
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ status: 'ok', reason: null, claims: [{ ...claim, price: null }] }) }] }] });
  } }));
  const result = await audit(plan.id, source);
  assert.equal(oauth, 1); assert.equal(extraction, 1);
  assert.equal(result.status, 'needs_review');
  assert.ok(result.issues.some(x => x.code === 'comparator_unavailable'));
  assert.equal(result.findings[0].finding.paypal.planId, plan.id);
  assert.deepEqual(result.findings[0].finding.website, claim.evidence);
});

test('extraction review and missing selected offers never invoke the comparator', async () => {
  for (const output of [{ status: 'needs_review', claims: [], reason: 'Ambiguous' }, { status: 'ok', claims: [{ ...claim, offerLabel: 'Other' }] }, { status: 'ok', claims: [] }]) {
    const result = await makeAudit(async () => output)(plan.id, source, () => assert.fail('must not compare'));
    assert.equal(result.status, 'needs_review');
    assert.equal(result.findings.length, 0);
    assert.ok(result.issues.some(x => x.code === 'missing_claims'));
    if (output.status === 'needs_review') assert.ok(result.issues.some(x => x.code === 'extraction_needs_review'));
  }
});

test('provider failures and malformed or unrelated claims fail safely', async () => {
  for (const extract of [async () => { throw Error('PRIVATE KEY'); }, async () => ({ status: 'ok', claims: [{ ...claim, evidence: { ...claim.evidence, quote: 'invented' } }] }), async () => ({ status: 'ok', claims: [{ ...claim, duration: { unit: 'HOUR', count: 1 } }] })]) {
    const result = await makeAudit(extract)(plan.id, source);
    assert.equal(result.status, 'failed');
    assert.ok(result.issues.some(x => x.code === 'provider_failed' && x.stage === 'claims'));
    assert.ok(!JSON.stringify(result).includes('PRIVATE KEY'));
  }
});

test('invalid source and plan selection invoke neither provider', async () => {
  let calls = 0;
  const audit = createExtractedPlanAudit(createPlanAudit(async () => { calls++; return plan; }), async () => { calls++; return { status: 'ok', claims: [] }; });
  assert.equal((await audit(plan.id, { ...source, sourceUrl: 'file:///private' })).status, 'failed');
  assert.equal((await audit(plan.id, { ...source, sourceUrl: 'not-a-url' })).status, 'failed');
  assert.equal((await audit('../invalid', source)).status, 'failed');
  assert.equal(calls, 0);
});

test('later comparator can replace review fallback without modifying extraction', async () => {
  const result = await makeAudit(async () => ({ status: 'ok', claims: [claim] }))(plan.id, source, ({ plan, claim }) => ({ status: 'needs_review', field: claim.field, offerLabel: claim.offerLabel, website: claim.evidence, paypal: { planId: plan.id, retrievedAt: plan.retrievedAt, fieldPath: 'billingCycles' }, summary: 'TEST DOUBLE: pending financial rules.' }));
  assert.deepEqual(result.issues, []);
  assert.equal(result.findings[0].finding.summary, 'TEST DOUBLE: pending financial rules.');
});

test('HTTP input accepts source mode and rejects mixed modes or missing offer selection', async () => {
  const request = body => new Request('http://localhost/api/audits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.deepEqual(await readAuditRequest(request({ planId: plan.id, source })), { planId: plan.id, source });
  for (const body of [{ planId: plan.id, source, claims: [] }, { planId: plan.id, source: { sourceUrl: source.sourceUrl, sourceText: source.sourceText } }]) await assert.rejects(readAuditRequest(request(body)), { status: 400 });
});
