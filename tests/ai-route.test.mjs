import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/ai/extract/route.ts';

const sourceText = 'PlanMirror Pro — $9.99/month.';
const claim = { field: 'recurring_price', offerLabel: 'PlanMirror Pro', evidence: { url: 'https://example.com/pricing', quote: '$9.99/month' }, price: { value: '9.99', currencyCode: 'USD' }, quotedInterval: { unit: 'MONTH', count: 1 }, billedInterval: { unit: 'MONTH', count: 1 } };
const request = body => new Request('http://localhost/api/ai/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('rejects invalid extraction requests before calling OpenAI', async () => {
  const response = await POST(request({ sourceUrl: 'not-a-url', sourceText: '' }));
  assert.equal(response.status, 400);
});

test('returns validated extraction results from the server route', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ output_text: JSON.stringify({ status: 'ok', claims: [claim] }) }), { status: 200 });
  try {
    const response = await POST(request({ sourceUrl: 'https://example.com/pricing', sourceText }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).claims[0].price.value, '9.99');
  } finally { globalThis.fetch = originalFetch; if (previousKey) process.env.OPENAI_API_KEY = previousKey; else delete process.env.OPENAI_API_KEY; }
});

test('maps missing OpenAI configuration to service unavailable', async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try { assert.equal((await POST(request({ sourceUrl: 'https://example.com/pricing', sourceText }))).status, 503); }
  finally { if (previous) process.env.OPENAI_API_KEY = previous; }
});
