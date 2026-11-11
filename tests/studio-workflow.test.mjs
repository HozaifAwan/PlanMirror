import assert from 'node:assert/strict';
import test from 'node:test';
import { runStudioAudit } from '../lib/studio/audit-workflow.ts';
import { quillfoxClaims } from '../lib/audit/quillfox.ts';

const plan = {
  id: 'P-DEMO123', productId: 'PROD-DEMO', name: 'Quillfox Pro', status: 'ACTIVE',
  retrievedAt: '2026-11-09T18:00:00.000Z',
  billingCycles: [
    { sequence: 1, tenure: 'TRIAL', totalCycles: 1, interval: { unit: 'DAY', count: 7 }, fixedPrice: { value: '0.00', currencyCode: 'USD' } },
    { sequence: 2, tenure: 'REGULAR', totalCycles: 0, interval: { unit: 'MONTH', count: 1 }, fixedPrice: { value: '19.99', currencyCode: 'USD' } },
  ],
};

test('live handoff compares and displays one exact plan snapshot', async () => {
  let reads = 0;
  const { result, run } = await runStudioAudit({ planId: plan.id, mode: 'labeled' }, {
    readPlan: async () => { reads++; return structuredClone(plan); },
    extract: async () => { throw new Error('Labeled audits must not use OpenAI'); },
  });
  assert.equal(reads, 1);
  assert.equal(result.status, 'completed');
  assert.equal(run.source, 'live');
  assert.equal(run.findings.length, 2);
  assert.ok(run.findings.every(record => record.finding.status === 'mismatch'));
  assert.match(run.findings[0].configuredDisplay, /7 days/);
  assert.equal(run.findings[1].configuredDisplay, 'USD 19.99');
  assert.ok(run.findings.every(record => record.finding.paypal.retrievedAt === run.retrievedAt));
  assert.match(run.id, /^[0-9a-f-]{36}$/);
});

test('AI extraction uses the existing validated source-mode adapter', async () => {
  let source;
  const { run } = await runStudioAudit({ planId: plan.id, mode: 'extract' }, {
    readPlan: async () => structuredClone(plan),
    extract: async input => { source = input; return { status: 'ok', claims: quillfoxClaims().map(item => item.claim) }; },
  });
  assert.equal(source.sourceUrl, 'https://planmirror.local/quillfox');
  assert.equal(source.offerLabel, 'Quillfox Pro');
  assert.ok(run.findings.every(record => source.sourceText.includes(record.finding.website.quote)));
  assert.ok(run.findings.every(record => record.claimId.startsWith('extracted-')));
});

test('ambiguous extraction remains review without fabricated findings', async () => {
  const { run, result } = await runStudioAudit({ planId: plan.id, mode: 'extract' }, {
    readPlan: async () => structuredClone(plan),
    extract: async () => ({ status: 'needs_review', claims: [], reason: 'Ambiguous offer' }),
  });
  assert.equal(run.status, 'needs_review');
  assert.deepEqual(run.findings, []);
  assert.ok(result.issues.some(issue => issue.code === 'extraction_needs_review'));
});

test('provider failures and unrelated evidence never create a live result', async () => {
  for (const failure of ['plan', 'extract', 'quote']) {
    const { result, run } = await runStudioAudit({ planId: plan.id, mode: 'extract' }, {
      readPlan: async () => { if (failure === 'plan') throw new Error('private provider detail'); return structuredClone(plan); },
      extract: async () => {
        if (failure === 'extract') throw new Error('private provider detail');
        return { status: 'ok', claims: [{ ...quillfoxClaims()[0].claim, evidence: { url: 'https://planmirror.local/quillfox', quote: 'Invented quote' } }] };
      },
    });
    assert.equal(run, undefined);
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.findings, []);
    assert.ok(!JSON.stringify(result).includes('private provider detail'));
  }
});

test('corrected copy clears the trial mismatch against the same sandbox plan', async () => {
  const configured = structuredClone(plan);
  configured.billingCycles[1].fixedPrice.value = '9.99';
  const reads = [];
  const providers = {
    readPlan: async id => { reads.push(id); return configured; },
    extract: async () => { throw new Error('Corrected copy does not need extraction'); },
  };
  const original = await runStudioAudit({ planId: plan.id, mode: 'labeled' }, providers);
  const corrected = await runStudioAudit({ planId: plan.id, mode: 'corrected' }, providers);
  assert.deepEqual(reads, [plan.id, plan.id]);
  assert.notEqual(original.run.id, corrected.run.id);
  assert.deepEqual(original.run.findings.map(record => record.finding.status), ['mismatch', 'match']);
  assert.deepEqual(corrected.run.findings.map(record => record.finding.status), ['match', 'match']);
  assert.match(corrected.run.findings[0].finding.website.url, /#corrected-offer$/);
  assert.equal(corrected.run.findings[0].finding.website.quote, '7 days free, then USD 9.99 per month.');
});

test('pricing and stale FAQ claims retain distinct verdicts against one plan read', async () => {
  const configured = structuredClone(plan);
  configured.billingCycles[1].fixedPrice.value = '9.99';
  let reads = 0;
  const { run } = await runStudioAudit({ planId: plan.id, mode: 'cross_page' }, {
    readPlan: async () => { reads++; return configured; },
    extract: async () => { throw new Error('Cross-page audit uses published claims'); },
  });
  assert.equal(reads, 1);
  const pricing = run.findings.find(record => record.id === 'quillfox-monthly');
  const faq = run.findings.find(record => record.id === 'quillfox-faq-monthly');
  assert.equal(pricing.finding.status, 'match');
  assert.equal(faq.finding.status, 'mismatch');
  assert.match(faq.finding.website.url, /\/faq#stale-note$/);
});
