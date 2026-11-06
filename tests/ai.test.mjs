import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOffers, parseResponsesText } from '../lib/ai/extract.ts';

const sourceText = 'PlanMirror Pro — 30-day free trial, then $9.99/month. Billed monthly.';
const claim = { field: 'recurring_price', offerLabel: 'PlanMirror Pro', evidence: { url: 'https://example.com/pricing', quote: '$9.99/month' }, price: { value: '9.99', currencyCode: 'USD' }, quotedInterval: { unit: 'MONTH', count: 1 }, billedInterval: { unit: 'MONTH', count: 1 } };
const response = value => rawResponse(value);
const rawResponse = value => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }), { status: 200 });

test('normalizes nullable billing cadence without inventing a value', async () => {
  const result = await extractOffers({
    sourceText, sourceUrl: claim.evidence.url, apiKey: 'test',
    fetcher: async () => rawResponse({ status: 'ok', reason: null, claims: [{ ...claim, billedInterval: null }] }),
  });
  const expected = { ...claim };
  delete expected.billedInterval;
  assert.deepEqual(result, { status: 'ok', claims: [expected] });
});

test('rejects refusals and incomplete output', () => {
  assert.throws(() => parseResponsesText({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }), /refusal/);
  assert.throws(() => parseResponsesText({ status: 'incomplete', output: [] }), /incomplete/);
});

test('parses raw Responses API output after reasoning items', () => {
  assert.equal(parseResponsesText({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] }), '{"ok":true}');
});

test('accepts valid claims with exact source quotes', async () => { const result = await extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => response({ status: 'ok', claims: [claim] }) }); assert.equal(result.status, 'ok'); assert.equal(result.claims[0].price.value, '9.99'); });
test('accepts raw Responses API responses', async () => { const result = await extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => rawResponse({ status: 'ok', claims: [claim] }) }); assert.equal(result.status, 'ok'); });
test('returns needs_review for unverifiable quotes', async () => { const result = await extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => response({ status: 'ok', claims: [{ ...claim, evidence: { ...claim.evidence, quote: '$12/month' } }] }) }); assert.equal(result.status, 'needs_review'); });
test('rejects malformed model output', async () => { await assert.rejects(extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{bad' }] }] }) }), /malformed/); });
test('rejects missing terms and unsupported cadence through Zod', async () => { await assert.rejects(extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => response({ status: 'ok', claims: [{ ...claim, quotedInterval: { unit: 'HOUR', count: 1 } }] }) }), /invalid extraction shape/); });
test('requires server-side API configuration', async () => { await assert.rejects(extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: '' }), /not configured/); });

test('bounds extraction with a native 15-second signal and private request options', async t => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    assert.equal(milliseconds, 15_000);
    return controller.signal;
  });
  await extractOffers({ sourceText, sourceUrl: claim.evidence.url, apiKey: 'test', fetcher: async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    return response({ status: 'ok', claims: [claim] });
  } });
});

test('sanitizes aborted transport errors without waiting for the timeout', async t => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, 'timeout', () => controller.signal);
  await assert.rejects(extractOffers({ sourceText, sourceUrl: claim.evidence.url, apiKey: 'private-key', fetcher: async (_url, { signal }) => {
    const pending = new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    controller.abort(new Error('private-key and private source text'));
    return pending;
  } }), { message: 'OpenAI extraction request failed.' });
});

test('keeps the timeout active for response body reads and sanitizes abort errors', async t => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, 'timeout', () => controller.signal);
  await assert.rejects(extractOffers({ sourceText, sourceUrl: claim.evidence.url, apiKey: 'test', fetcher: async (_url, { signal }) => ({
    ok: true,
    json: async () => {
      assert.equal(signal, controller.signal);
      const pending = new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      controller.abort(new Error('private response body'));
      return pending;
    },
  }) }), { message: 'OpenAI extraction response could not be read.' });
});

test('sanitizes network and malformed response body errors', async () => {
  await assert.rejects(extractOffers({ sourceText, sourceUrl: claim.evidence.url, apiKey: 'test', fetcher: async () => { throw new Error('private network details'); } }), { message: 'OpenAI extraction request failed.' });
  await assert.rejects(extractOffers({ sourceText, sourceUrl: claim.evidence.url, apiKey: 'test', fetcher: async () => new Response('private malformed body') }), { message: 'OpenAI extraction response could not be read.' });
});
