/**
 * shots.mjs — capture full-page screenshots of every site page at desktop and
 * mobile widths, for visual review.
 *
 * Usage:  node mcp/shots.mjs [baseUrl] [outDir]
 * Default: http://localhost:8794  ->  shots/
 *
 * Blocks Cloudflare Turnstile (it 400s on localhost and floods the console),
 * forces lazy images to load, and freezes animations so captures are stable.
 */

import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://localhost:8794';
const OUT = path.resolve(__dirname, '..', process.argv[3] || 'shots');

const PAGES = [
  ['home',      '/index.html'],
  ['windows',   '/windows.html'],
  ['andersen',  '/andersen.html'],
  ['doors',     '/doors.html'],
  ['gallery',   '/gallery.html'],
  ['about',     '/about.html'],
  ['faq',       '/faq.html'],
  ['blog',      '/blog.html'],
  ['post',      '/blog/why-replace-windows-bend-oregon.html'],
];

const VIEWPORTS = [
  ['desktop', 1440, 900],
  ['mobile',  390, 844],
];

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];

for (const [vpName, width, height] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  // Turnstile 400s on localhost and never settles — block it entirely.
  await ctx.route('**challenges.cloudflare.com**', r => r.abort());

  for (const [name, url] of PAGES) {
    const page = await ctx.newPage();
    const problems = [];
    page.on('console', m => {
      if (m.type() === 'error' && !/challenges\.cloudflare/.test(m.text())) problems.push(m.text().slice(0, 120));
    });
    page.on('requestfailed', r => {
      if (!/challenges\.cloudflare/.test(r.url())) problems.push(`FAILED ${r.url().split('/').pop()}`);
    });

    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });

      // Freeze motion + force every lazy image in.
      await page.addStyleTag({ content:
        '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
      await page.evaluate(async () => {
        document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
        const h = document.body.scrollHeight;
        for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
        await Promise.all([...document.images].map(i =>
          i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r; })));
      });
      await page.waitForTimeout(700);

      // Post-load health check.
      const health = await page.evaluate(() => ({
        brokenImages: [...document.images]
          .filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pageHeight: document.body.scrollHeight,
        emptyHeadings: [...document.querySelectorAll('h1,h2,h3')]
          .filter(h => !h.textContent.trim()).length,
      }));

      const file = path.join(OUT, `${name}-${vpName}.jpeg`);
      await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 82 });

      report.push({ page: name, vp: vpName, ...health, problems: problems.slice(0, 5), file });
      const flags = [
        health.brokenImages.length ? `${health.brokenImages.length} BROKEN IMG` : '',
        health.overflowX > 0 ? `OVERFLOW ${health.overflowX}px` : '',
        health.emptyHeadings ? `${health.emptyHeadings} empty headings` : '',
        problems.length ? `${problems.length} console err` : '',
      ].filter(Boolean).join(', ');
      console.log(`  ${vpName.padEnd(7)} ${name.padEnd(10)} ${String(health.pageHeight).padStart(6)}px  ${flags || 'clean'}`);
    } catch (err) {
      console.log(`  ${vpName.padEnd(7)} ${name.padEnd(10)} ERROR: ${err.message.slice(0, 80)}`);
      report.push({ page: name, vp: vpName, error: err.message });
    }
    await page.close();
  }
  await ctx.close();
}

await browser.close();

const bad = report.filter(r => r.error || r.brokenImages?.length || r.overflowX > 0 || r.problems?.length);
console.log(`\n${bad.length ? `⚠️  ${bad.length} page/viewport combos with issues` : '✓ all pages clean'}`);
console.log(`Screenshots: ${OUT}`);
