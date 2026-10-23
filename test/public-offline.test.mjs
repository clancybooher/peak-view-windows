/**
 * Temporary public-site outage gate.
 * Run: node --test test/public-offline.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker.js';

const SENTENCE = 'Peak View Windows & Doors is temporarily offline. Back soon.';

function visibleText(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
const PUBLIC_HOSTS = ['peakvieworegon.com', 'www.peakvieworegon.com'];
const PUBLIC_PATHS = [
  '/',
  '/windows',
  '/contact',
  '/blog',
  '/blog/foggy-windows-bend-oregon',
  '/automations',
  '/window-replacement-redmond-oregon',
  '/sitemap.xml',
  '/robots.txt',
  '/api/submit',
  '/logo.png',
  '/index.html',
];

function assetsEnv() {
  const calls = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        calls.push(new URL(request.url).pathname);
        return new Response('asset-body', {
          status: 200,
          headers: { 'X-From-Assets': '1' },
        });
      },
    },
  };
  return { env, calls };
}

for (const host of PUBLIC_HOSTS) {
  for (const path of PUBLIC_PATHS) {
    test(`https://${host}${path} is 503 and does not touch assets`, async () => {
      const { env, calls } = assetsEnv();
      const res = await worker.fetch(new Request(`https://${host}${path}`), env);
      assert.equal(res.status, 503);
      assert.equal(res.headers.get('Retry-After'), '172800');
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
      assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
      const body = await res.text();
      assert.ok(visibleText(body).includes(SENTENCE));
      assert.doesNotMatch(body, /541|Bend|@|CCB|mailto|tel:/i);
      assert.deepEqual(calls, []);
    });
  }
}

test('POST /api/submit on the apex is 503', async () => {
  const { env, calls } = assetsEnv();
  const res = await worker.fetch(new Request('https://peakvieworegon.com/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }), env);
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('Retry-After'), '172800');
  assert.deepEqual(calls, []);
});

test('http on the apex is 503, not a redirect', async () => {
  const { env } = assetsEnv();
  const res = await worker.fetch(new Request('http://peakvieworegon.com/windows'), env);
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('Location'), null);
});

test('www with a query string is 503, not a canonical redirect', async () => {
  const { env } = assetsEnv();
  const res = await worker.fetch(new Request('https://www.peakvieworegon.com/contact?ref=ad'), env);
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('Location'), null);
  assert.ok(visibleText(await res.text()).includes(SENTENCE));
});

test('portal.peakvieworegon.com passes through to assets', async () => {
  const { env, calls } = assetsEnv();
  const res = await worker.fetch(new Request('https://portal.peakvieworegon.com/'), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-From-Assets'), '1');
  assert.equal(await res.text(), 'asset-body');
  assert.deepEqual(calls, ['/']);
});

test('a workers.dev hostname passes through to assets', async () => {
  const { env, calls } = assetsEnv();
  const res = await worker.fetch(new Request('https://peak-view-windows.example.workers.dev/windows'), env);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'asset-body');
  assert.deepEqual(calls, ['/windows']);
});

test('an unrelated www host passes through to assets', async () => {
  const { env, calls } = assetsEnv();
  const res = await worker.fetch(new Request('https://www.example.com/'), env);
  assert.equal(res.status, 200);
  assert.deepEqual(calls, ['/']);
});

test('portal hostname keeps the existing html canonical redirect', async () => {
  const { env, calls } = assetsEnv();
  const res = await worker.fetch(new Request('https://portal.peakvieworegon.com/windows.html'), env);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('Location'), 'https://portal.peakvieworegon.com/windows');
  assert.deepEqual(calls, []);
});

test('portal hostname keeps the existing http to https redirect', async () => {
  const { env, calls } = assetsEnv();
  const res = await worker.fetch(new Request('http://portal.peakvieworegon.com/'), env);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('Location'), 'https://portal.peakvieworegon.com/');
  assert.deepEqual(calls, []);
});
