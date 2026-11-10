import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOffers, parseResponsesText } from '../lib/ai/extract.ts';

const sourceText = 'PlanMirror Pro — 30-day free trial, then $9.99/month. Billed monthly.';
const claim = { field: 'recurring_price', offerLabel: 'PlanMirror Pro', evidence: { url: 'https://example.com/pricing', quote: '$9.99/month' }, price: { value: '9.99', currencyCode: 'USD' }, quotedInterval: { unit: 'MONTH', count: 1 }, billedInterval: { unit: 'MONTH', count: 1 } };
const response = value => rawResponse(value);
const rawResponse = value => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }), { status: 200 });

test('sends a strict provider schema with supported evidence URLs and typed claim discriminants', async () => {
  let request;
  const result = await extractOffers({
    sourceText: `${sourceText} Setup fee USD5.`, sourceUrl: claim.evidence.url, apiKey: 'test',
    fetcher: async (_url, options) => {
      request = JSON.parse(options.body);
      return rawResponse({ status: 'ok', reason: null, claims: [claim] });
    },
  });

  // Inspect the serialized provider contract, rather than a private schema export.
  const format = request.text.format;
  assert.equal(format.type, 'json_schema');
  assert.equal(format.strict, true);
  assert.equal(format.schema.additionalProperties, false);
  const branches = format.schema.properties.claims.items.anyOf;
  assert.deepEqual(branches.map(branch => branch.properties.field.const).sort(),
    ['billing_interval', 'recurring_price', 'setup_fee', 'trial']);
  for (const branch of branches) {
    assert.equal(branch.properties.field.type, 'string', 'each const discriminant needs an explicit provider type');
    const url = branch.properties.evidence.properties.url;
    assert.equal(url.type, 'string');
    assert.equal(Object.hasOwn(url, 'format'), false, 'the provider does not support the uri format');
  }
  assert.deepEqual(result, { status: 'ok', claims: [claim] });
});

test('constrains every provider claim to the selected offer and accepts matching output', async () => {
  let request;
  const result = await extractOffers({
    sourceText, sourceUrl: claim.evidence.url, offerLabel: claim.offerLabel, apiKey: 'test',
    fetcher: async (_url, options) => {
      request = JSON.parse(options.body);
      return rawResponse({ status: 'ok', reason: null, claims: [claim] });
    },
  });
  for (const branch of request.text.format.schema.properties.claims.items.anyOf) {
    assert.equal(branch.properties.offerLabel.type, 'string');
    assert.equal(branch.properties.offerLabel.const, claim.offerLabel);
  }
  assert.deepEqual(result, { status: 'ok', claims: [claim] });
});

test('reviews an absent selected offer without calling the provider', async () => {
  let calls = 0;
  const result = await extractOffers({
    sourceText, sourceUrl: claim.evidence.url, offerLabel: 'PlanMirror Enterprise', apiKey: 'test',
    fetcher: async () => {
      calls += 1;
      return rawResponse({ status: 'ok', reason: null, claims: [claim] });
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, 'needs_review');
  assert.deepEqual(result.claims, []);
});

test('reviews output for a different offer despite an exact source quote', async () => {
  const result = await extractOffers({
    sourceText, sourceUrl: claim.evidence.url, offerLabel: claim.offerLabel, apiKey: 'test',
    fetcher: async () => rawResponse({ status: 'ok', reason: null, claims: [{ ...claim, offerLabel: 'Renewal' }] }),
  });
  assert.equal(result.status, 'needs_review');
  assert.deepEqual(result.claims, []);
});

test('omits setup fees from the provider contract when the source only names a recurring price', async () => {
  let request;
  const result = await extractOffers({
    sourceText, sourceUrl: claim.evidence.url, apiKey: 'test',
    fetcher: async (_url, options) => {
      request = JSON.parse(options.body);
      return rawResponse({ status: 'ok', reason: null, claims: [{
        field: 'setup_fee', offerLabel: claim.offerLabel, evidence: claim.evidence, price: claim.price,
      }] });
    },
  });
  const fields = request.text.format.schema.properties.claims.items.anyOf.map(branch => branch.properties.field.const);
  assert.deepEqual(fields.sort(), ['billing_interval', 'recurring_price', 'trial']);
  assert.equal(result.status, 'needs_review');
  assert.deepEqual(result.claims, []);
});

test('accepts a setup fee supported by an explicit fee quote', async () => {
  const fee = {
    field: 'setup_fee', offerLabel: claim.offerLabel,
    evidence: { url: claim.evidence.url, quote: 'Setup fee USD5.' },
    price: { value: '5', currencyCode: 'USD' },
  };
  const result = await extractOffers({
    sourceText: `${sourceText} ${fee.evidence.quote}`, sourceUrl: claim.evidence.url, apiKey: 'test',
    fetcher: async () => rawResponse({ status: 'ok', reason: null, claims: [fee] }),
  });
  assert.deepEqual(result, { status: 'ok', claims: [fee] });
});

test('still rejects malformed evidence URLs through server validation', async () => {
  await assert.rejects(extractOffers({
    sourceText, sourceUrl: claim.evidence.url, apiKey: 'test',
    fetcher: async () => rawResponse({ status: 'ok', reason: null, claims: [{
      ...claim, evidence: { ...claim.evidence, url: 'not a URL' },
    }] }),
  }), /invalid extraction shape/);
});

test('requires evidence to use the source URL even when its quote matches exactly', async () => {
  const result = await extractOffers({
    sourceText, sourceUrl: claim.evidence.url, apiKey: 'test',
    fetcher: async () => rawResponse({ status: 'ok', reason: null, claims: [{
      ...claim, evidence: { ...claim.evidence, url: 'https://other.example/pricing' },
    }] }),
  });
  assert.equal(result.status, 'needs_review');
  assert.deepEqual(result.claims, []);
});

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
    assert.equal(JSON.parse(options.body).max_output_tokens, 4096);
    assert.equal(JSON.parse(options.body).store, false);
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
