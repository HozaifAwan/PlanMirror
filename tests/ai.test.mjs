import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOffers } from '../lib/ai/extract.ts';

const sourceText = 'PlanMirror Pro — 30-day free trial, then $9.99/month. Billed monthly.';
const claim = { field: 'recurring_price', offerLabel: 'PlanMirror Pro', evidence: { url: 'https://example.com/pricing', quote: '$9.99/month' }, price: { value: '9.99', currencyCode: 'USD' }, quotedInterval: { unit: 'MONTH', count: 1 }, billedInterval: { unit: 'MONTH', count: 1 } };
const response = value => new Response(JSON.stringify({ output_text: JSON.stringify(value) }), { status: 200 });

test('accepts valid claims with exact source quotes', async () => { const result = await extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => response({ status: 'ok', claims: [claim] }) }); assert.equal(result.status, 'ok'); assert.equal(result.claims[0].price.value, '9.99'); });
test('returns needs_review for unverifiable quotes', async () => { const result = await extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => response({ status: 'ok', claims: [{ ...claim, evidence: { ...claim.evidence, quote: '$12/month' } }] }) }); assert.equal(result.status, 'needs_review'); });
test('rejects malformed model output', async () => { await assert.rejects(extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => new Response(JSON.stringify({ output_text: '{bad' }), { status: 200 }) }), /malformed/); });
test('rejects missing terms and unsupported cadence through Zod', async () => { await assert.rejects(extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: 'test', fetcher: async () => response({ status: 'ok', claims: [{ ...claim, quotedInterval: { unit: 'HOUR', count: 1 } }] }) }), /invalid extraction shape/); });
test('requires server-side API configuration', async () => { await assert.rejects(extractOffers({ sourceText, sourceUrl: 'https://example.com/pricing', apiKey: '' }), /not configured/); });
