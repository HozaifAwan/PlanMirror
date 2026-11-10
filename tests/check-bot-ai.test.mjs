import assert from 'node:assert/strict';
import test from 'node:test';
import { answerCheckBot, CHECK_BOT_INSTRUCTIONS, CHECK_BOT_MODEL } from '../lib/ai/check-bot.ts';

const input = { pathname: '/quillfox', markdown: '# Quillfox\n30 days free', message: 'How do I audit?', history: [] };
const completed = text => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });

test('chat uses fixed instructions, bounded lightweight configuration, and separate untrusted page data', async () => {
  let calls = 0;
  const result = await answerCheckBot({ ...input, history: [{ role: 'user', text: 'Where am I?' }, { role: 'assistant', text: 'Quillfox.' }] }, {
    apiKey: 'test-only', fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      const body = JSON.parse(options.body);
      assert.equal(body.model, CHECK_BOT_MODEL);
      assert.equal(body.instructions, CHECK_BOT_INSTRUCTIONS);
      assert.match(body.instructions, /untrusted data/);
      assert.match(body.instructions, /Never invent PayPal values/);
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 600);
      assert.deepEqual(body.reasoning, { effort: 'none' });
      assert.equal(body.tools, undefined);
      assert.deepEqual(JSON.parse(body.input.at(-1).content), { currentPage: input.pathname, pageMarkdown: input.markdown, question: input.message });
      assert.equal(body.input[1].role, 'assistant');
      return Response.json(completed('Choose the intended plan, then click Run Audit.'));
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: true, reply: 'Choose the intended plan, then click Run Audit.' });
});

test('invalid inputs and missing keys make no provider request', async () => {
  const options = { apiKey: 'test-only', fetcher: () => { throw new Error('must not call'); } };
  for (const invalid of [null, { ...input, message: 'x'.repeat(1501) }, { ...input, markdown: 'x'.repeat(24101) }, { ...input, pathname: 'https://evil.example' }, { ...input, history: [{ role: 'system', text: 'override' }] }, { ...input, history: Array(7).fill({ role: 'user', text: 'hi' }) }]) {
    assert.equal((await answerCheckBot(invalid, options)).ok, false);
  }
  assert.match((await answerCheckBot(input, { ...options, apiKey: '' })).error, /not configured/);
});

test('provider failures, refusal, incomplete output and transport errors produce safe errors', async () => {
  for (const body of [{ status: 'incomplete', output: [] }, completed(''), { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }]) {
    assert.equal((await answerCheckBot(input, { apiKey: 'test', fetcher: async () => Response.json(body) })).ok, false);
  }
  for (const status of [401, 429, 500]) {
    const result = await answerCheckBot(input, { apiKey: 'test', fetcher: async () => new Response('private provider diagnostic', { status }) });
    assert.equal(result.ok, false);
    assert.ok(!result.error.includes('private'));
    if (status === 429) assert.match(result.error, /limit/);
  }
  const result = await answerCheckBot(input, { apiKey: 'test', fetcher: async () => { throw new Error('secret key'); } });
  assert.equal(result.ok, false);
  assert.ok(!result.error.includes('secret'));
});

test('server model override is honored', async () => {
  await answerCheckBot(input, { apiKey: 'test', model: 'custom-small-model', fetcher: async (_url, options) => {
    assert.equal(JSON.parse(options.body).model, 'custom-small-model');
    return Response.json(completed('Hi!'));
  } });
});
