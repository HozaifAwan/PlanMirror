// Integration smoke check against a running local Next server. Never prints credentials.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const base = process.env.PLANMIRROR_TEST_ORIGIN ?? 'http://localhost:3000';
const secret = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
if (!secret) throw Error('Configure PLANMIRROR_SANDBOX_READ_TOKEN first.');
const headers = { Authorization: 'Bearer ' + secret };
const cases = [
  ['/api/paypal/plans', undefined, 401],
  ['/api/paypal/plans', { Authorization: 'Bearer wrong' }, 401],
  ['/api/paypal/plans?page=0', headers, 400],
  ['/api/paypal/plans/not-a-plan', headers, 400],
  ['/api/paypal/plans/P-' + randomBytes(12).toString('hex').toUpperCase(), headers, 404],
  ['/api/paypal/plans?page_size=1', headers, 200],
];
if (process.env.PAYPAL_SANDBOX_PLAN_ID) cases.push(['/api/paypal/plans/' + process.env.PAYPAL_SANDBOX_PLAN_ID, headers, 200]);
for (const [path, auth, expected] of cases) {
  const res = await fetch(base + path, { headers: auth });
  const body = await res.text();
  assert.equal(res.status, expected, path + ': ' + res.status);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  for (const value of [secret, process.env.PAYPAL_CLIENT_SECRET, process.env.PAYPAL_CLIENT_ID]) {
    if (value) assert.equal(body.includes(value), false, 'Response leaked a credential');
  }
  assert.equal(body.includes('access_token'), false);
  console.log('PASS', expected, path);
}
