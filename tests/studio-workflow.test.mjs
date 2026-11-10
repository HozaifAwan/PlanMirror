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
