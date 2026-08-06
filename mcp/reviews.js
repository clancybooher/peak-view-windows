/**
 * reviews.js — scrape the live Google Business reviews for Peak View and
 * regenerate the homepage testimonials + AggregateRating schema.
 *
 * Uses playwright-core driving the already-installed system Chrome
 * (channel: 'chrome') — no browser download required.
 *
 * Google Maps renders reviews with JavaScript, so a plain fetch cannot read
 * them; a real browser is required.
 */

import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(SITE_ROOT, 'index.html');

/** Peak View's Google Place ID (from the g.page review link). */
export const PLACE_ID = 'ChIJ3cmFtGNCMWUR63LN2zWhwVQ';

/** Filler openers/closers worth trimming when a review needs shortening. */
const FILLER_PATTERNS = [
  /^(hi|hello|hey|help+!?|wow)[!,. ]+/i,
  /^(i|we) (would |highly |really )?(just )?want(ed)? to (say|share|note)[^.!?]*[.!?]\s*/i,
];

/**
 * Shorten a long review to <= maxLen characters by keeping whole sentences,
 * preferring the ones with substance (product names, numbers, outcomes) and
 * joining non-adjacent kept sentences with an ellipsis.
 *
 * Never rewrites words — output fragments are always verbatim substrings.
 */
export function condense(text, maxLen = 340) {
  let t = String(text).replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  for (const p of FILLER_PATTERNS) t = t.replace(p, '');
  if (t.length <= maxLen) return t;

  // Split into sentences, keeping terminators.
  const sentences = t.match(/[^.!?]+[.!?]+["')\]]*\s*/g)?.map(s => s.trim()).filter(Boolean) || [t];

  // Score each sentence: concrete detail beats generic praise.
  const score = (s) => {
    let n = 0;
    // Outcomes the buyer cares about rank highest.
    if (/temperature|energy|efficien|quiet|draft|comfortable|seal|transform/i.test(s)) n += 5;
    if (/window/i.test(s)) n += 3;                                // windows > doors (site focus)
    if (/\d/.test(s)) n += 3;                                     // concrete quantities
    if (/andersen|series|casement|double-hung|glid|picture window/i.test(s)) n += 3;
    if (/recommend|professional|quality|clean|detail|efficient|flawless/i.test(s)) n += 2;
    // Past-year project recaps read as dated on a live site.
    if (/\b(in|back in)\s+20\d\d\b/i.test(s)) n -= 3;
    if (s.length < 40) n -= 1;
    return n;
  };

  const ranked = sentences.map((s, i) => ({ s, i, sc: score(s) }))
    .sort((a, b) => b.sc - a.sc || a.i - b.i);

  const picked = [];
  let len = 0;
  for (const r of ranked) {
    if (len + r.s.length > maxLen && picked.length) continue;
    picked.push(r);
    len += r.s.length + 2;
    if (len >= maxLen) break;
  }
  picked.sort((a, b) => a.i - b.i);

  // Join, inserting an ellipsis wherever we skipped sentences.
  let out = '';
  for (let k = 0; k < picked.length; k++) {
    if (k > 0) out += (picked[k].i === picked[k - 1].i + 1) ? ' ' : '… ';
    out += picked[k].s.replace(/\s+$/, '');
  }
  if (picked[0].i > 0) out = out.replace(/^/, '');
  return out.trim();
}

/** HTML-escape for page content. */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Escape for a JSON-LD string value. */
const jsonEsc = (s) => String(s)
  .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s*\n+\s*/g, ' ');

/** Normalize the display name Google shows ("Jane Doe3 reviews · 2 photos"). */
function cleanName(raw) {
  let n = String(raw)
    .replace(/Local Guide\s*·.*$/i, '')
    .replace(/\d+\s*reviews?\s*(·.*)?$/i, '')
    .replace(/\d+\s*photos?\s*$/i, '')
    .replace(/·\s*$/, '')
    .trim();
  // Title-case a lowercase first name ("Rachel and amar Chahal")
  return n.replace(/\b([a-z])([a-z]+)\b/g, (m, a, b) =>
    ['and', 'the', 'of'].includes(m) ? m : a.toUpperCase() + b);
}

/**
 * Scrape all reviews from the Google Maps listing.
 * Returns { total, average, reviews: [{name, rating, date, text}] }
 */
export async function scrapeReviews({ placeId = PLACE_ID, headless = false, timeoutMs = 90000 } = {}) {
  // NOTE: this must run HEADED against a PERSISTENT profile.
  //  - Headless Chrome gets a stripped-down Maps page with no reviews tab.
  //  - A brand-new profile gets the same reduced page (no consent/session state).
  // Reusing a persistent profile directory gives us the full interactive Maps UI.
  // The window is parked off-screen so it does not interrupt anything.
  const profileDir = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright', 'peakview-reviews-profile');
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless,
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    args: ['--window-position=-2400,-2400', '--window-size=1280,900'],
  });
  const browser = context;
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(`https://www.google.com/maps/place/?q=place_id:${placeId}`,
      { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(3500);

    // Consent screen (varies by region) — accept if present.
    for (const sel of ['button[aria-label*="Accept"]', 'button:has-text("Accept all")']) {
      const b = page.locator(sel).first();
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await page.waitForTimeout(1200); }
    }

    // Open the Reviews tab. Google sometimes serves a reduced place page on the
    // first hit; reloading the resolved canonical URL gets the full interactive UI.
    const findTab = () => page
      .locator('button[aria-label^="Reviews for"], button[role="tab"]:has-text("Reviews")').first();

    if (!(await findTab().count())) {
      const resolved = page.url();
      if (/\/maps\/place\//.test(resolved)) {
        await page.goto(resolved, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await page.waitForTimeout(4000);
      }
    }

    const tab = findTab();
    if (await tab.count()) { await tab.click(); await page.waitForTimeout(2800); }

    // Scroll the feed until the review count stops growing.
    await page.evaluate(async () => {
      const feed = document.querySelector('div[role="feed"]') ||
        [...document.querySelectorAll('div')]
          .filter(d => d.scrollHeight > d.clientHeight + 200 && d.clientHeight > 300).pop();
      if (!feed) return;
      let last = -1;
      for (let i = 0; i < 40; i++) {
        feed.scrollTop = feed.scrollHeight;
        await new Promise(r => setTimeout(r, 850));
        const n = document.querySelectorAll('div[data-review-id]').length;
        if (n === last && i > 4) break;
        last = n;
      }
      for (const b of [...document.querySelectorAll('button')]
        .filter(b => /^more$/i.test(b.textContent.trim()) || b.getAttribute('aria-label') === 'See more')) {
        try { b.click(); await new Promise(r => setTimeout(r, 90)); } catch {}
      }
      await new Promise(r => setTimeout(r, 900));
    });

    const data = await page.evaluate(() => {
      const seen = new Set();
      const reviews = [];
      for (const el of document.querySelectorAll('div[data-review-id]')) {
        const id = el.getAttribute('data-review-id');
        if (seen.has(id)) continue;
        const name = el.querySelector('.d4r55, [class*="d4r55"]')?.textContent.trim();
        const text = el.querySelector('.wiI7pd, [class*="wiI7pd"], .MyEned')?.textContent.trim();
        if (!name || !text) continue;
        const starLabel = el.querySelector('[role="img"][aria-label*="star"], span[aria-label*="star"]')
          ?.getAttribute('aria-label') || '';
        seen.add(id);
        reviews.push({
          name,
          rating: parseInt(starLabel, 10) || null,
          date: el.querySelector('.rsqaWe, [class*="rsqaWe"]')?.textContent.trim() || '',
          text,
        });
      }
      // Headline totals shown by Google.
      const body = document.body.innerText;
      const totalMatch = body.match(/([\d,]+)\s+reviews?/i);
      const avgMatch = document.querySelector('div.fontDisplayLarge')?.textContent.trim();
      return {
        reviews,
        totalText: totalMatch ? totalMatch[1].replace(/,/g, '') : null,
        avgText: avgMatch || null,
      };
    });

    const reviews = data.reviews.map(r => ({ ...r, name: cleanName(r.name) }));
    const rated = reviews.filter(r => r.rating);
    const average = data.avgText && /^\d/.test(data.avgText)
      ? parseFloat(data.avgText)
      : (rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10 : null);

    return {
      total: data.totalText ? parseInt(data.totalText, 10) : reviews.length,
      average,
      scrapedCount: reviews.length,
      reviews,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Rewrite the testimonial cards and AggregateRating/review schema in index.html.
 * `picked` is the array of reviews to feature (already ordered).
 */
export function applyToIndex({ picked, total, average, maxLen = 340, schemaCount = 3 }) {
  let doc = readFileSync(INDEX, 'utf8');

  // ---- testimonial cards ----
  const cards = picked.map(r => {
    const body = condense(r.text, maxLen);
    return `        <div class="t-card">
          <div class="t-stars" aria-label="${r.rating || 5} out of 5 stars">${'&#9733;'.repeat(r.rating || 5)}</div>
          <p class="t-body">"${esc(body).replace(/…/g, '&hellip;')}"</p>
          <div class="t-name">${esc(r.name)}</div>
          <div class="t-loc">Google Review</div>
        </div>`;
  }).join('\n\n');

  const trackRe = /(<div class="testimonials-track" id="t-track">\n)([\s\S]*?)(\n\s*<\/div>\n\s*<\/div>\n\s*<div class="testimonials-controls">)/;
  if (!trackRe.test(doc)) throw new Error('Could not locate the testimonials track in index.html');
  doc = doc.replace(trackRe, `$1\n${cards}\n$3`);

  // ---- aggregateRating ----
  const avg = (average ?? 5).toFixed(1);
  doc = doc.replace(
    /("aggregateRating":\s*\{)[\s\S]*?(\},)/,
    `$1
      "@type": "AggregateRating",
      "ratingValue": "${avg}",
      "reviewCount": "${total}",
      "bestRating": "5",
      "worstRating": "1"
    $2`
  );

  // ---- review array in schema ----
  const schemaReviews = picked.slice(0, schemaCount).map(r => `      {
        "@type": "Review",
        "author": {"@type": "Person", "name": "${jsonEsc(r.name)}"},
        "reviewRating": {"@type": "Rating", "ratingValue": "${r.rating || 5}", "bestRating": "5"},
        "reviewBody": "${jsonEsc(condense(r.text, 600))}"
      }`).join(',\n');

  doc = doc.replace(/("review":\s*\[)[\s\S]*?(\n\s*\],)/, `$1\n${schemaReviews}$2`);

  writeFileSync(INDEX, doc, 'utf8');
  return { cardCount: picked.length, average: avg, total };
}
