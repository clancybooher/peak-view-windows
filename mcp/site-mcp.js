#!/usr/bin/env node
/**
 * site-mcp.js — Peak View website MCP server ("peak-view-site")
 *
 * Lets Clancy write a blog post in plain language and publish it to
 * peakvieworegon.com without touching HTML.
 *
 * Source of truth is blog/posts.json. blog.html and sitemap.xml are always
 * REGENERATED from it, so the index can never drift from the posts that exist.
 *
 * Safety: publishing is outward-facing, so it follows the same draft-then-approve
 * rule as every write tool in the CRM server — draft_post writes nothing.
 * deploy_site is never called automatically.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

import {
  renderPost, renderIndex, slugify, prettyDate, toPlainText, renderMarkdown,
} from './templates.js';
import { scrapeReviews, applyToIndex, condense, PLACE_ID } from './reviews.js';

const execFileP = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(SITE_ROOT, 'blog');
const MANIFEST = path.join(BLOG_DIR, 'posts.json');
const INDEX_PAGE = path.join(SITE_ROOT, 'blog.html');
const SITEMAP = path.join(SITE_ROOT, 'sitemap.xml');
const SITE = 'https://peakvieworegon.com';

/** Static pages that must always appear in the sitemap, with their priorities. */
const STATIC_PAGES = [
  { loc: '/',              priority: '1.0', changefreq: 'monthly' },
  { loc: '/windows.html',  priority: '0.9', changefreq: 'monthly' },
  { loc: '/andersen.html', priority: '0.9', changefreq: 'monthly' },
  { loc: '/doors.html',    priority: '0.9', changefreq: 'monthly' },
  { loc: '/blog.html',     priority: '0.8', changefreq: 'weekly'  },
  { loc: '/gallery.html',  priority: '0.8', changefreq: 'monthly' },
  { loc: '/about.html',    priority: '0.7', changefreq: 'yearly'  },
  { loc: '/faq.html',      priority: '0.7', changefreq: 'monthly' },
];

const today = () => new Date().toISOString().slice(0, 10);

function ensureBlogDir() {
  if (!existsSync(BLOG_DIR)) mkdirSync(BLOG_DIR, { recursive: true });
}

function loadPosts() {
  ensureBlogDir();
  if (!existsSync(MANIFEST)) return [];
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    return Array.isArray(parsed) ? parsed : (parsed.posts ?? []);
  } catch (err) {
    throw new Error(`blog/posts.json is not valid JSON (${err.message}). Fix or delete it before publishing.`);
  }
}

function savePosts(posts) {
  ensureBlogDir();
  const sorted = [...posts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  return sorted;
}

/** Rebuild blog.html + sitemap.xml from the manifest. Always safe to re-run. */
function rebuild(posts) {
  writeFileSync(INDEX_PAGE, renderIndex(posts), 'utf8');

  const live = posts
    .filter(p => p.status !== 'draft')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const newest = live[0]?.updated || live[0]?.date || today();
  const urls = [
    ...STATIC_PAGES.map(p => ({
      loc: `${SITE}${p.loc}`,
      lastmod: p.loc === '/blog.html' ? newest : today(),
      changefreq: p.changefreq,
      priority: p.priority,
    })),
    ...live.map(p => ({
      loc: `${SITE}/blog/${p.slug}.html`,
      lastmod: p.updated || p.date,
      changefreq: 'yearly',
      priority: '0.6',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  writeFileSync(SITEMAP, xml, 'utf8');
  return { indexPath: INDEX_PAGE, sitemapPath: SITEMAP, liveCount: live.length };
}

const text = (s) => ({ content: [{ type: 'text', text: s }] });

const server = new McpServer({
  name: 'peak-view-site',
  version: '1.0.0',
});

/* ── list_posts ─────────────────────────────────────────────── */
server.tool('list_posts',
  'List every blog post on peakvieworegon.com — slug, title, date, tag, status (published or draft), and excerpt. Read-only. Use this before updating or unpublishing so you know the exact slug.',
  {},
  async () => {
    const posts = loadPosts();
    if (!posts.length) return text('No blog posts yet. Use draft_post to write the first one.');
    const lines = posts.map(p =>
      `• [${p.status === 'draft' ? 'DRAFT' : 'LIVE '}] ${p.slug}\n` +
      `    "${p.title}"\n` +
      `    ${prettyDate(p.date)} · ${p.tag || 'Article'}${p.updated ? ` · updated ${prettyDate(p.updated)}` : ''}\n` +
      `    ${p.excerpt || ''}\n` +
      `    ${SITE}/blog/${p.slug}.html`
    );
    return text(`${posts.length} post(s):\n\n${lines.join('\n\n')}`);
  }
);

/* ── draft_post ─────────────────────────────────────────────── */
server.tool('draft_post',
  'Preview a blog post WITHOUT writing any files. Takes a title and a markdown body and returns the slug, meta description, and a plain-text preview of how it will read. ALWAYS run this and show Clancy the result before calling publish_post. Writes nothing to disk.',
  {
    title:   z.string().describe('Post headline, e.g. "Why Replacing Your Windows in Bend Matters"'),
    body:    z.string().describe('Post body in markdown. Supports ## / ### headings, paragraphs, - bullets, 1. numbered lists, **bold**, *italic*, [links](url), > quotes, and --- rules.'),
    tag:     z.string().optional().describe('Category label shown on the card, e.g. "Energy Efficiency", "Product Guide". Default "Article".'),
    excerpt: z.string().optional().describe('1–2 sentence summary for the card and meta description. Auto-generated from the body if omitted.'),
    slug:    z.string().optional().describe('URL slug. Auto-generated from the title if omitted.'),
    image:   z.string().optional().describe('Site-relative image path, e.g. "photos/andersen/andersen-exterior.jpg".'),
  },
  async ({ title, body, tag, excerpt, slug, image }) => {
    const s = slug ? slugify(slug) : slugify(title);
    const ex = excerpt || toPlainText(body, 165);
    const words = toPlainText(body).split(/\s+/).filter(Boolean).length;
    const existing = loadPosts().find(p => p.slug === s);

    return text(
      `DRAFT PREVIEW — nothing has been written.\n\n` +
      `Title:    ${title}\n` +
      `Slug:     ${s}\n` +
      `URL:      ${SITE}/blog/${s}.html\n` +
      `Tag:      ${tag || 'Article'}\n` +
      `Image:    ${image || '(none — card will show a text placeholder)'}\n` +
      `Length:   ~${words} words\n` +
      `Excerpt:  ${ex}\n` +
      (existing ? `\n⚠️  A post with slug "${s}" already exists ("${existing.title}"). Publishing will OVERWRITE it — use update_post instead, or pick a different slug.\n` : '') +
      `\n─────────── READS AS ───────────\n\n${toPlainText(body, 1200)}\n\n` +
      `────────────────────────────────\n` +
      `If Clancy approves, call publish_post with the same arguments.`
    );
  }
);

/* ── publish_post ───────────────────────────────────────────── */
server.tool('publish_post',
  'Publish a blog post to the site: writes blog/<slug>.html, updates the posts manifest, and regenerates blog.html and sitemap.xml. ONLY call this after showing Clancy a draft_post preview and getting explicit approval. Does NOT deploy — the post goes live only when deploy_site runs.',
  {
    title:   z.string().describe('Post headline'),
    body:    z.string().describe('Post body in markdown'),
    tag:     z.string().optional().describe('Category label, e.g. "Energy Efficiency"'),
    excerpt: z.string().optional().describe('1–2 sentence summary. Auto-generated if omitted.'),
    slug:    z.string().optional().describe('URL slug. Auto-generated from the title if omitted.'),
    image:   z.string().optional().describe('Site-relative image path, e.g. "photos/andersen/andersen-exterior.jpg"'),
    imageAlt: z.string().optional().describe('Alt text for the image'),
    date:    z.string().optional().describe('Publish date YYYY-MM-DD. Defaults to today.'),
    faq:     z.array(z.object({ q: z.string(), a: z.string() })).optional()
               .describe('Optional Q&A pairs appended as an accordion and emitted as FAQPage schema for Google.'),
    status:  z.enum(['published', 'draft']).optional()
               .describe('"draft" writes the file but keeps it off the index and sitemap. Default "published".'),
  },
  async (args) => {
    const slug = args.slug ? slugify(args.slug) : slugify(args.title);
    if (!slug) return text('ERROR: could not derive a usable slug from that title. Pass an explicit slug.');

    const date = args.date || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return text(`ERROR: date must be YYYY-MM-DD, got "${date}".`);

    if (args.image) {
      const imgPath = path.join(SITE_ROOT, args.image.replace(/^\/+/, ''));
      if (!existsSync(imgPath)) {
        return text(`ERROR: image not found at ${args.image} (looked in ${imgPath}). Publish aborted — fix the path or omit the image.`);
      }
    }

    const posts = loadPosts();
    const idx = posts.findIndex(p => p.slug === slug);
    const wasExisting = idx >= 0;

    const entry = {
      slug,
      title: args.title,
      date,
      tag: args.tag || 'Article',
      excerpt: args.excerpt || toPlainText(args.body, 165),
      image: args.image || '',
      imageAlt: args.imageAlt || args.title,
      status: args.status || 'published',
      body: args.body,
      faq: args.faq || [],
      ...(wasExisting ? { updated: today() } : {}),
    };

    if (wasExisting) posts[idx] = entry; else posts.push(entry);

    ensureBlogDir();
    const postPath = path.join(BLOG_DIR, `${slug}.html`);
    writeFileSync(postPath, renderPost(entry), 'utf8');
    const saved = savePosts(posts);
    const built = rebuild(saved);

    return text(
      `${wasExisting ? 'UPDATED' : 'PUBLISHED'}: "${args.title}"\n\n` +
      `  Post:    blog/${slug}.html\n` +
      `  Index:   blog.html (regenerated — ${built.liveCount} live post(s))\n` +
      `  Sitemap: sitemap.xml (regenerated)\n` +
      `  Status:  ${entry.status}\n` +
      `  Live at: ${SITE}/blog/${slug}.html (after deploy)\n\n` +
      `Files are written locally. Run deploy_site when Clancy is ready to push it live.`
    );
  }
);

/* ── update_post ────────────────────────────────────────────── */
server.tool('update_post',
  'Edit an existing published post. Pass the slug plus only the fields you want to change — everything else is kept. Regenerates the post page, blog.html, and sitemap.xml. Show Clancy what is changing before calling this.',
  {
    slug:    z.string().describe('Slug of the post to edit (get it from list_posts)'),
    title:   z.string().optional(),
    body:    z.string().optional().describe('Replaces the entire markdown body'),
    tag:     z.string().optional(),
    excerpt: z.string().optional(),
    image:   z.string().optional(),
    imageAlt: z.string().optional(),
    status:  z.enum(['published', 'draft']).optional(),
    faq:     z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  },
  async (args) => {
    const posts = loadPosts();
    const idx = posts.findIndex(p => p.slug === slugify(args.slug));
    if (idx < 0) {
      return text(`ERROR: no post with slug "${args.slug}". Run list_posts to see what exists.`);
    }

    if (args.image) {
      const imgPath = path.join(SITE_ROOT, args.image.replace(/^\/+/, ''));
      if (!existsSync(imgPath)) return text(`ERROR: image not found at ${args.image}. Update aborted.`);
    }

    const changed = Object.keys(args).filter(k => k !== 'slug' && args[k] !== undefined);
    if (!changed.length) return text('Nothing to change — pass at least one field besides slug.');

    const entry = { ...posts[idx] };
    for (const k of changed) entry[k] = args[k];
    entry.updated = today();
    posts[idx] = entry;

    writeFileSync(path.join(BLOG_DIR, `${entry.slug}.html`), renderPost(entry), 'utf8');
    const saved = savePosts(posts);
    const built = rebuild(saved);

    return text(
      `UPDATED: "${entry.title}"\n\n` +
      `  Changed: ${changed.join(', ')}\n` +
      `  Post:    blog/${entry.slug}.html\n` +
      `  Index:   blog.html (regenerated — ${built.liveCount} live post(s))\n` +
      `  Sitemap: sitemap.xml (regenerated)\n\n` +
      `Run deploy_site to push the change live.`
    );
  }
);

/* ── unpublish_post ─────────────────────────────────────────── */
server.tool('unpublish_post',
  'Take a post off the blog index and sitemap. By default the HTML file is kept on disk so it can be restored; pass deleteFile:true to remove it entirely. Confirm with Clancy first.',
  {
    slug: z.string().describe('Slug of the post to unpublish'),
    deleteFile: z.boolean().optional().describe('Also delete blog/<slug>.html. Default false (file is kept).'),
  },
  async ({ slug, deleteFile }) => {
    const s = slugify(slug);
    const posts = loadPosts();
    const idx = posts.findIndex(p => p.slug === s);
    if (idx < 0) return text(`ERROR: no post with slug "${slug}". Run list_posts to see what exists.`);

    const title = posts[idx].title;
    let removedFile = false;

    if (deleteFile) {
      posts.splice(idx, 1);
      const f = path.join(BLOG_DIR, `${s}.html`);
      if (existsSync(f)) { unlinkSync(f); removedFile = true; }
    } else {
      posts[idx] = { ...posts[idx], status: 'draft', updated: today() };
    }

    const saved = savePosts(posts);
    const built = rebuild(saved);

    return text(
      `UNPUBLISHED: "${title}"\n\n` +
      `  ${deleteFile ? `Deleted blog/${s}.html and removed it from the manifest.` : `Marked as draft — blog/${s}.html kept on disk, hidden from the index.`}\n` +
      `  Index:   blog.html (regenerated — ${built.liveCount} live post(s))\n` +
      `  Sitemap: sitemap.xml (regenerated)\n` +
      (removedFile ? '' : `\nTo restore it: update_post({ slug: "${s}", status: "published" })\n`) +
      `\nRun deploy_site to push the change live.`
    );
  }
);

/* ── rebuild_blog ───────────────────────────────────────────── */
server.tool('rebuild_blog',
  'Regenerate blog.html, every post page, and sitemap.xml from blog/posts.json. Use after editing the manifest by hand, or after changing the page templates. Safe to run any time — it only rewrites generated files.',
  {},
  async () => {
    const posts = loadPosts();
    ensureBlogDir();
    for (const p of posts) {
      writeFileSync(path.join(BLOG_DIR, `${p.slug}.html`), renderPost(p), 'utf8');
    }
    const built = rebuild(posts);
    return text(
      `REBUILT from blog/posts.json:\n` +
      `  ${posts.length} post page(s)\n` +
      `  blog.html (${built.liveCount} live)\n` +
      `  sitemap.xml\n\nRun deploy_site to push live.`
    );
  }
);

/* ── check_reviews ──────────────────────────────────────────── */
server.tool('check_reviews',
  'Read the LIVE Google Business reviews for Peak View and compare them to what is currently on the website. Read-only — changes nothing. Shows the current star average and review count, which reviews are new since the site was last updated, and how each would be trimmed for a testimonial card. Run this first, show Clancy, then use update_reviews if he approves.',
  {
    limit: z.number().optional().describe('Max reviews to list in the report. Default 20.'),
  },
  async ({ limit }) => {
    let data;
    try {
      data = await scrapeReviews({});
    } catch (err) {
      return text(`Could not read Google reviews: ${err.message}\n\nThis needs Google Chrome installed (it drives the real browser because Maps renders reviews with JavaScript).`);
    }
    if (!data.reviews.length) {
      return text('Loaded the Google listing but found no reviews — the page layout may have changed. Nothing was modified.');
    }

    const doc = readFileSync(path.join(SITE_ROOT, 'index.html'), 'utf8');
    const onSite = [...doc.matchAll(/<div class="t-name">([^<]+)<\/div>/g)].map(m => m[1].trim());
    const liveNames = data.reviews.map(r => r.name);
    const isNew = liveNames.filter(n => !onSite.includes(n));
    const gone = onSite.filter(n => !liveNames.includes(n));

    const ratingMatch = doc.match(/"ratingValue":\s*"([\d.]+)"[\s\S]{0,80}?"reviewCount":\s*"(\d+)"/);
    const siteAvg = ratingMatch?.[1], siteCount = ratingMatch?.[2];

    const lines = data.reviews.slice(0, limit || 20).map(r => {
      const flag = onSite.includes(r.name) ? 'ON SITE' : 'NEW    ';
      const trimmed = condense(r.text, 340);
      const wasTrimmed = trimmed.length < r.text.replace(/\s+/g, ' ').trim().length;
      return `[${flag}] ${'★'.repeat(r.rating || 5)} ${r.name}${r.date ? ` · ${r.date}` : ''}\n` +
             `   ${trimmed}${wasTrimmed ? '\n   (trimmed from the full review)' : ''}`;
    });

    return text(
      `LIVE GOOGLE REVIEWS — nothing has been changed.\n\n` +
      `  Rating now:   ${data.average ?? '?'} stars from ${data.total} reviews\n` +
      `  Site claims:  ${siteAvg ?? '(none)'} stars from ${siteCount ?? '(none)'} reviews` +
        `${siteAvg && (siteAvg !== String(data.average?.toFixed(1)) || siteCount !== String(data.total)) ? '   ← OUT OF DATE' : '   ✓ matches'}\n` +
      `  Featured:     ${onSite.length} testimonials on the homepage\n` +
      (isNew.length ? `  New reviews:  ${isNew.length} (${isNew.slice(0, 6).join(', ')}${isNew.length > 6 ? '…' : ''})\n` : `  New reviews:  none\n`) +
      (gone.length ? `  ⚠️  On the site but NOT on Google now: ${gone.join(', ')}\n` : '') +
      `\n────────────────────────────────────────\n\n${lines.join('\n\n')}\n\n` +
      `────────────────────────────────────────\n` +
      `To refresh the site: update_reviews (optionally pass featured:[names] to choose which appear).`
    );
  }
);

/* ── update_reviews ─────────────────────────────────────────── */
server.tool('update_reviews',
  'Refresh the homepage testimonials and the AggregateRating schema from the live Google reviews. Long reviews are trimmed to their strongest sentences joined with ellipses — fragments always stay VERBATIM, never reworded. Show Clancy check_reviews output first and get approval. Does NOT deploy.',
  {
    featured: z.array(z.string()).optional()
      .describe('Reviewer names to feature, in order. Omit to auto-pick the best (longest/most detailed 5-star reviews).'),
    count: z.number().optional().describe('How many testimonials to show when auto-picking. Default 6.'),
    maxLength: z.number().optional().describe('Max characters per testimonial card before trimming. Default 340.'),
    ratingOnly: z.boolean().optional()
      .describe('Only refresh the star average and review count in the schema; leave the testimonial cards untouched.'),
  },
  async ({ featured, count, maxLength, ratingOnly }) => {
    let data;
    try {
      data = await scrapeReviews({});
    } catch (err) {
      return text(`Could not read Google reviews: ${err.message}\nNothing was changed.`);
    }
    if (!data.reviews.length) return text('No reviews found on the Google listing — nothing was changed.');

    const doc = readFileSync(path.join(SITE_ROOT, 'index.html'), 'utf8');

    let picked;
    if (ratingOnly) {
      // Keep whatever is on the page; just re-derive it from the live set by name.
      const names = [...doc.matchAll(/<div class="t-name">([^<]+)<\/div>/g)].map(m => m[1].trim());
      picked = names.map(n => data.reviews.find(r => r.name === n)).filter(Boolean);
      if (picked.length !== names.length) {
        return text(`ratingOnly aborted: some testimonials on the site are no longer on Google (${names.filter(n => !data.reviews.some(r => r.name === n)).join(', ')}). Run check_reviews and pick a new set.`);
      }
    } else if (featured?.length) {
      const missing = featured.filter(n => !data.reviews.some(r => r.name.toLowerCase() === n.toLowerCase()));
      if (missing.length) {
        return text(`These names are not in the live Google reviews: ${missing.join(', ')}\n\nAvailable: ${data.reviews.map(r => r.name).join(', ')}\n\nNothing was changed.`);
      }
      picked = featured.map(n => data.reviews.find(r => r.name.toLowerCase() === n.toLowerCase()));
    } else {
      picked = data.reviews
        .filter(r => (r.rating ?? 5) >= 5)
        .sort((a, b) => b.text.length - a.text.length)
        .slice(0, count || 6);
    }

    if (!picked.length) return text('No reviews selected — nothing was changed.');

    let result;
    try {
      result = applyToIndex({
        picked,
        total: data.total,
        average: data.average,
        maxLen: maxLength || 340,
      });
    } catch (err) {
      return text(`Update failed: ${err.message}\nindex.html was not modified.`);
    }

    // Verify the rewritten JSON-LD still parses.
    const after = readFileSync(path.join(SITE_ROOT, 'index.html'), 'utf8');
    const blocks = [...after.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const b of blocks) {
      try { JSON.parse(b[1]); }
      catch (e) { return text(`⚠️ WROTE index.html BUT THE SCHEMA IS NOW INVALID: ${e.message}\nCheck index.html before deploying.`); }
    }

    return text(
      `REVIEWS UPDATED on index.html\n\n` +
      `  Rating:      ${result.average} stars from ${result.total} reviews\n` +
      `  Testimonials: ${result.cardCount}\n` +
      picked.map(r => `    · ${r.name} ${'★'.repeat(r.rating || 5)}`).join('\n') + '\n' +
      `  Schema:      valid (${blocks.length} JSON-LD block(s) parsed)\n\n` +
      `All quoted text is verbatim from Google — trimmed with ellipses, never reworded.\n` +
      `Run deploy_site when Clancy is ready to push it live.`
    );
  }
);

/* ── deploy_site ────────────────────────────────────────────── */
server.tool('deploy_site',
  'Deploy peakvieworegon.com to Cloudflare (runs `npx wrangler deploy`). This makes changes PUBLICLY VISIBLE. Never call automatically — only when Clancy explicitly says to deploy or push it live.',
  {
    confirm: z.boolean().describe('Must be true. Set only after Clancy has explicitly asked to deploy.'),
  },
  async ({ confirm }) => {
    if (!confirm) return text('Deploy cancelled — confirm was not true. Ask Clancy before deploying.');
    try {
      const { stdout, stderr } = await execFileP('npx', ['wrangler', 'deploy'], {
        cwd: SITE_ROOT,
        timeout: 180000,
        maxBuffer: 1024 * 1024 * 8,
      });
      const out = `${stdout}\n${stderr}`.trim();
      return text(`DEPLOYED to Cloudflare.\n\n${out.slice(-2500)}`);
    } catch (err) {
      const detail = `${err.stdout || ''}\n${err.stderr || ''}`.trim() || err.message;
      return text(`DEPLOY FAILED.\n\n${detail.slice(-2500)}`);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
