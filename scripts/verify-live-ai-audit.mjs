// Explicit opt-in live verification: incurs small OpenAI usage, reads PayPal only.
// Run after npm run build: node --env-file=.env.local scripts/verify-live-ai-audit.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';

const base = 'http://127.0.0.1:3138';
const gate = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
const planId = process.env.PAYPAL_SANDBOX_PLAN_ID;
assert.ok(process.env.OPENAI_API_KEY?.trim(), 'Configure OPENAI_API_KEY locally.');
assert.ok(gate?.length >= 32, 'Configure the local read token.');
assert.match(planId ?? '', /^P-[A-Z0-9]{1,48}$/, 'Select the intended seven-day Quillfox sandbox plan.');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3138'], {
  env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
});
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Verification server did not start.')), 15000);
    server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } });
    server.once('error', () => { clearTimeout(timer); reject(Error('Verification server unavailable.')); });
    server.once('exit', () => { clearTimeout(timer); reject(Error('Verification server exited.')); });
  });
  const sourceText = 'Quillfox Pro\n30 days free, then USD 9.99 per month.';
  const page = await fetch(base + '/quillfox', { signal: AbortSignal.timeout(10000) });
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('30 days free, then USD 9.99 per month.'));
  const response = await fetch(base + '/api/audits', {
    method: 'POST', signal: AbortSignal.timeout(45000),
    headers: { Authorization: 'Bearer ' + gate, 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, source: { sourceUrl: base + '/quillfox', sourceText, offerLabel: 'Quillfox Pro' } }),
  });
  const text = await response.text();
  for (const key of ['OPENAI_API_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PLANMIRROR_SANDBOX_READ_TOKEN']) {
    if (process.env[key]) assert.ok(!text.includes(process.env[key]), 'Private value in response.');
  }
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = JSON.parse(text);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.issues, []);
  assert.ok(result.findings.some(x => x.finding.field === 'trial' && x.finding.status === 'mismatch' && /30 days.*7 days/.test(x.finding.summary)));
  assert.ok(result.findings.some(x => x.finding.field === 'recurring_price' && x.finding.status === 'match'));
  assert.ok(!result.findings.some(x => x.finding.field === 'setup_fee'), 'Unadvertised setup fee was invented.');
  for (const { finding } of result.findings) {
    assert.equal(finding.offerLabel, 'Quillfox Pro');
    assert.equal(finding.paypal?.planId, planId);
    assert.equal(finding.website?.url, base + '/quillfox');
    assert.ok(sourceText.includes(finding.website.quote));
  }
  writeFileSync('.next/live-ai-audit-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), planId, source: 'real_openai_and_paypal_sandbox', result }, null, 2) + '\n');
  console.log('PASS: live OpenAI extraction -> protected audit API -> real PayPal -> comparator.');
  console.log('PASS: 30-day versus 7-day trial mismatch, monthly price match, no invented setup fee.');
  console.log('PASS: selected offer, exact source quotes and credential exclusion.');
} catch {
  console.error('Live AI audit verification failed. No success claimed; check configured keys, selected plan and provider access.');
  process.exitCode = 1;
} finally {
  if (server.exitCode === null && !server.killed) {
    const stopped = once(server, 'exit'); server.kill(); await stopped;
  }
}
