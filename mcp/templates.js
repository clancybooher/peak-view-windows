/**
 * templates.js — page shells + markdown rendering for peakvieworegon.com
 *
 * Every blog page (index and posts) is rendered from these templates so the
 * blog can never drift out of sync with the rest of the site. All styling comes
 * from the existing styles.css — no new CSS is introduced anywhere here.
 */

const SITE = 'https://peakvieworegon.com';
const PHONE_DISPLAY = '541-639-3968';
const PHONE_HREF = '+15416393968';
const EMAIL = 'clancy@peakvieworegon.com';

/** Escape text for use in HTML body content. */
export function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for use inside a JSON-LD string value. */
function jsonEsc(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/** "why-replace-windows" from "Why Replace Windows?" */
export function slugify(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** 2026-08-04 -> "August 4, 2026" */
export function prettyDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

/**
 * Minimal, dependency-free markdown -> HTML.
 * Supports: ## / ### headings, paragraphs, - bullets, 1. numbered lists,
 * **bold**, *italic*, [links](url), > blockquote, and --- rules.
 * Inline HTML in the source is passed through untouched.
 */
export function renderMarkdown(md = '') {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // 'ul' | 'ol'

  const inline = (t) =>
    esc(t)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const flushPara = () => {
    if (para.length) {
      out.push(`      <p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`      </${list}>`);
      list = null;
    }
  };
  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { flushAll(); continue; }

    // Pass raw HTML blocks straight through.
    if (/^<(figure|img|div|section|table|iframe|blockquote|p|h[1-6])[\s>]/i.test(line)) {
      flushAll();
      out.push(`      ${line}`);
      continue;
    }

    if (line === '---' || line === '***') {
      flushAll();
      out.push('      <hr style="border:none;border-top:1px solid var(--border);margin:2.5rem 0" />');
      continue;
    }

    let m;
    if ((m = line.match(/^###\s+(.*)$/))) {
      flushAll();
      out.push(`      <h3 style="font-size:clamp(1.25rem,2.5vw,1.55rem);margin:2rem 0 .75rem">${inline(m[1])}</h3>`);
      continue;
    }
    if ((m = line.match(/^##\s+(.*)$/))) {
      flushAll();
      out.push(`      <h2 style="font-size:clamp(1.6rem,3.5vw,2.25rem);margin:2.75rem 0 1rem">${inline(m[1])}</h2>`);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      flushAll();
      out.push(`      <blockquote style="border-left:3px solid var(--accent);padding-left:1.25rem;margin:2rem 0;color:var(--text-muted);font-style:italic">${inline(m[1])}</blockquote>`);
      continue;
    }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ul') { flushList(); out.push('      <ul style="margin:1.25rem 0 1.75rem;padding-left:1.25rem;list-style:disc">'); list = 'ul'; }
      out.push(`        <li style="margin-bottom:.6rem;color:var(--text-muted);line-height:1.8">${inline(m[1])}</li>`);
      continue;
    }
    if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      if (list !== 'ol') { flushList(); out.push('      <ol style="margin:1.25rem 0 1.75rem;padding-left:1.35rem;list-style:decimal">'); list = 'ol'; }
      out.push(`        <li style="margin-bottom:.6rem;color:var(--text-muted);line-height:1.8">${inline(m[1])}</li>`);
      continue;
    }

    flushList();
    para.push(line);
  }
  flushAll();
  return out.join('\n');
}

/** Strip markdown to plain text — used for auto-excerpts and meta descriptions. */
export function toPlainText(md = '', limit = 0) {
  let t = String(md)
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (limit && t.length > limit) {
    t = t.slice(0, limit).replace(/\s+\S*$/, '') + '…';
  }
  return t;
}

/** Shared nav. `active` is one of: home | windows | andersen | doors | gallery | about | blog */
function nav(active, prefix) {
  const cls = (k) => `nav__link${active === k ? ' active' : ''}`;
  return `<!-- NAV -->
<nav class="nav scrolled" id="nav" aria-label="Main navigation">
  <div class="nav__inner">
    <a href="/" class="nav__logo" aria-label="Peak View Windows &amp; Doors - home">
      <img src="/logo-light.png" alt="Peak View Windows &amp; Doors" width="56" height="56" class="nav__logo-full" />
    </a>
    <ul class="nav__links" role="list">
      <li><a href="/" class="${cls('home')}">Home</a></li>
      <li><a href="/windows" class="${cls('windows')}">Windows</a></li>
      <li><a href="/doors" class="${cls('doors')}">Doors</a></li>
      <li><a href="/gallery" class="${cls('gallery')}">Our Work</a></li>
      <li><a href="/about" class="${cls('about')}">About Us</a></li>
      <li><a href="/blog" class="${cls('blog')}">Blog</a></li>
    </ul>
    <div class="nav__actions">
      <a href="tel:${PHONE_HREF}" class="btn btn--nav-phone">${PHONE_DISPLAY}</a>
      <a href="/contact" class="btn btn--primary">Free Quote</a>
    </div>
    <a href="tel:${PHONE_HREF}" class="nav__mobile-phone" aria-label="Call Peak View Windows and Doors">${PHONE_DISPLAY}</a>
    <button class="nav__burger" id="burger" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<div class="mob-menu" id="mob-menu" role="dialog" aria-label="Navigation">
  <a href="/">Home</a>
  <a href="/windows">Windows</a>
  <a href="/doors">Doors</a>
  <a href="/gallery">Our Work</a>
  <a href="/about">About Us</a>
  <a href="/blog">Blog</a>
  <a href="/contact">Contact</a>
  <a href="/contact" class="btn btn--primary">Free Quote</a>
</div>`;
}

/** Shared footer. */
function footer(prefix) {
  return `<!-- FOOTER -->
<footer class="footer" aria-label="Site footer">
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="/logo.png" alt="Peak View Windows &amp; Doors" width="64" height="64" />
        <p>Luxury window replacement for homes across Central Oregon. Based in Bend. Licensed, insured, and accountable on every job.</p>
        <p class="license">CCB Licensed, Bonded &amp; Insured &nbsp;·&nbsp; License #260230</p>
        <p class="footer-nap">18550 Walton Rd<br>Bend, OR 97703<br><a href="tel:${PHONE_HREF}">${PHONE_DISPLAY}</a><br><a href="mailto:${EMAIL}">${EMAIL}</a><br>CCB #260230</p>
      </div>
      <div class="footer-col">
        <h4>Services</h4>
        <nav aria-label="Services">
          <a href="/windows">Window Replacement</a>
          <a href="/andersen">Andersen Window Replacement</a>
          <a href="/windows#energy">Energy Efficient Windows</a>
          <a href="/doors">Door Replacement</a>
          <a href="/doors#patio">Patio Door Replacement</a>
          <a href="/blog">Blog</a>
        </nav>
      </div>
      <div class="footer-col">
        <h4>Service Area</h4>
        <nav aria-label="Service area">
          <a href="/#contact">Bend</a>
          <a href="/#contact">Redmond</a>
          <a href="/#contact">Sisters</a>
          <a href="/#contact">Sunriver</a>
          <a href="/#contact">La Pine</a>
          <a href="/#contact">Tumalo</a>
          <a href="/#contact">Prineville</a>
          <a href="/#contact">Terrebonne</a>
        </nav>
      </div>
      <div class="footer-col">
        <h4>Contact</h4>
        <nav aria-label="Contact">
          <a href="/contact">Free Quote</a>
          <a href="/faq">FAQ</a>
          <a href="/about">About Us</a>
          <a href="tel:${PHONE_HREF}">${PHONE_DISPLAY}</a>
          <a href="mailto:${EMAIL}">${EMAIL}</a>
        </nav>
      </div>
    </div>
    <div class="footer-btm">
      <p>&copy; 2026 Peak View Windows &amp; Doors &nbsp;&middot;&nbsp; Bend, Oregon</p>
      <p>Serving Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne &amp; all of Central Oregon.</p>
    </div>
  </div>
</footer>

<!-- FLOATING PHONE FAB (mobile only) -->
<a href="tel:${PHONE_HREF}" class="phone-fab" aria-label="Call Peak View Windows and Doors">
  <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.09-1.09a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
</a>

<script src="/script.js?v=8"></script>`;
}

/** Closing CTA band shared by posts. */
function ctaBand(prefix) {
  return `<!-- CTA -->
<section class="cta-band" aria-labelledby="post-cta-h2">
  <div class="container">
    <p class="eyebrow">Free In-Home Quote</p>
    <h2 id="post-cta-h2" style="font-size:clamp(2rem,5vw,3.5rem)">Ready to Replace Your Windows?</h2>
    <p>We come to you, measure every opening you want replaced, and leave you with a firm itemized quote. Serving Bend, Redmond, Sisters &amp; all of Central Oregon.</p>
    <div class="cta-band__actions">
      <a href="tel:${PHONE_HREF}" class="btn btn--light">Call ${PHONE_DISPLAY}</a>
      <a href="/contact" class="btn btn--outline">Request a Quote Online</a>
    </div>
  </div>
</section>`;
}

/**
 * Render a full blog post page.
 * post: { slug, title, date, tag, excerpt, image, imageAlt, body (markdown), faq: [{q,a}] }
 */
export function renderPost(post) {
  const prefix = '../';
  const url = `${SITE}/blog/${post.slug}`;
  const desc = post.excerpt || toPlainText(post.body, 155);
  const img = post.image ? `${SITE}/${post.image.replace(/^\.\.\//, '')}` : `${SITE}/logo.png`;

  const faqSchema = (post.faq && post.faq.length)
    ? `

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
${post.faq.map(f => `      {
        "@type": "Question",
        "name": "${jsonEsc(f.q)}",
        "acceptedAnswer": {"@type": "Answer", "text": "${jsonEsc(f.a)}"}
      }`).join(',\n')}
    ]
  }
  </script>`
    : '';

  const faqBlock = (post.faq && post.faq.length)
    ? `
<!-- POST FAQ -->
<section style="background:var(--bg-alt)" aria-labelledby="pfaq-h2">
  <div class="container container--narrow">
    <div style="text-align:center;margin-bottom:clamp(2.5rem,5vw,4rem)">
      <p class="eyebrow" style="margin-bottom:.875rem">Common Questions</p>
      <h2 id="pfaq-h2" style="font-size:clamp(2rem,5vw,3.25rem)">Still Wondering?</h2>
    </div>
    <div class="faq-list">
${post.faq.map(f => `      <div class="faq-item">
        <button class="faq-q" aria-expanded="false">
          <span>${esc(f.q)}</span>
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </div>`).join('\n')}
    </div>
  </div>
</section>
`
    : '';

  // Sized to the article column so the image aligns with the text below it.
  const heroImg = post.image
    ? `
<!-- POST IMAGE -->
<div class="container container--narrow" style="margin-top:clamp(2.5rem,5vw,3.5rem)">
  <img src="${prefix}${esc(post.image)}" alt="${esc(post.imageAlt || post.title)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius-md);display:block" />
</div>
`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(post.title)} | Peak View Windows &amp; Doors</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <meta name="geo.region" content="US-OR" />
  <meta name="geo.placename" content="Bend, Oregon" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(post.title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="Peak View Windows &amp; Doors" />
  <meta property="article:published_time" content="${esc(post.date)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(post.title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${img}" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${jsonEsc(post.title)}",
    "description": "${jsonEsc(desc)}",
    "image": "${img}",
    "datePublished": "${esc(post.date)}",
    "dateModified": "${esc(post.updated || post.date)}",
    "author": {
      "@type": "Person",
      "name": "Clancy Booher",
      "jobTitle": "Owner",
      "url": "${SITE}/about"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Peak View Windows & Doors",
      "logo": {"@type": "ImageObject", "url": "${SITE}/logo.png"}
    },
    "mainEntityOfPage": {"@type": "WebPage", "@id": "${url}"}
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "Home", "item": "${SITE}/"},
      {"@type": "ListItem", "position": 2, "name": "Blog", "item": "${SITE}/blog"},
      {"@type": "ListItem", "position": 3, "name": "${jsonEsc(post.title)}", "item": "${url}"}
    ]
  }
  </script>${faqSchema}

  <link rel="stylesheet" href="/styles.css?v=12" />
  <link rel="icon" type="image/png" href="/logo.png" />
</head>
<body>

${nav('blog', prefix)}

<!-- PAGE HERO -->
<header class="page-hero" aria-labelledby="page-h1">
  <div class="container">
    <p class="eyebrow">${esc(post.tag || 'Peak View Journal')} &nbsp;·&nbsp; ${esc(prettyDate(post.date))}</p>
    <h1 id="page-h1">${esc(post.title)}</h1>
    ${post.excerpt ? `<p>${esc(post.excerpt)}</p>` : ''}
  </div>
</header>
${heroImg}
<!-- POST BODY -->
<section aria-label="Article" style="padding-top:clamp(2rem,4vw,3rem)">
  <div class="container container--narrow">
    <div class="about-body post-body">
${renderMarkdown(post.body)}
    </div>
    <p style="margin-top:2.5rem;font-size:.875rem;color:var(--text-light)">
      From the team at Peak View Windows &amp; Doors — CCB #260230, Bend, Oregon.
      Questions about your own windows? Call <a href="tel:${PHONE_HREF}" style="color:var(--accent)">${PHONE_DISPLAY}</a>.
    </p>
    <p style="margin-top:1.5rem">
      <a href="${prefix}blog" class="btn btn--ghost">&larr; All Articles</a>
    </p>
  </div>
</section>
${faqBlock}
${ctaBand(prefix)}

${footer(prefix)}
</body>
</html>
`;
}

/** Render the blog index from the manifest. */
export function renderIndex(posts) {
  const prefix = '';
  const live = posts
    .filter(p => p.status !== 'draft')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const cards = live.length
    ? live.map(p => {
        const imgStyle = p.image
          ? `background-image:url('${esc(p.image)}');background-size:cover;background-position:center`
          : `background:var(--bg-alt)`;
        return `      <a href="blog/${esc(p.slug)}" class="b-card" style="display:block">
        <div class="b-card__img" style="${imgStyle}">${p.image ? '' : esc(p.tag || 'Peak View')}</div>
        <div class="b-card__body">
          <p class="b-tag">${esc(p.tag || 'Article')}</p>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.excerpt || '')}</p>
          <p style="font-size:.78rem;color:var(--text-light);margin:0">${esc(prettyDate(p.date))}</p>
        </div>
      </a>`;
      }).join('\n')
    : `      <p style="color:var(--text-muted);grid-column:1/-1;text-align:center">New articles are on the way. In the meantime, give us a call at <a href="tel:${PHONE_HREF}" style="color:var(--accent)">${PHONE_DISPLAY}</a>.</p>`;

  const itemList = live.map((p, i) => `      {"@type": "ListItem", "position": ${i + 1}, "name": "${jsonEsc(p.title)}", "url": "${SITE}/blog/${p.slug}"}`).join(',\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Window Replacement Guides &amp; Advice | Peak View Windows &amp; Doors - Bend, Oregon</title>
  <meta name="description" content="Straight answers about replacing windows in Bend and Central Oregon — energy efficiency, product choices, costs, and what actually matters in our high-desert climate. From Peak View Windows &amp; Doors, CCB #260230." />
  <meta name="keywords" content="window replacement advice Bend Oregon, energy efficient windows Central Oregon, Andersen windows Bend blog, replacing windows Bend Oregon guide" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE}/blog" />
  <meta name="geo.region" content="US-OR" />
  <meta name="geo.placename" content="Bend, Oregon" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Window Replacement Guides &amp; Advice | Peak View Windows &amp; Doors" />
  <meta property="og:description" content="Straight answers about replacing windows in Bend and Central Oregon, from the crew that does the work." />
  <meta property="og:image" content="${SITE}/photos/andersen/andersen-100-room.jpg" />
  <meta property="og:url" content="${SITE}/blog" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="Peak View Windows &amp; Doors" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Window Replacement Guides &amp; Advice | Peak View Windows &amp; Doors" />
  <meta name="twitter:description" content="Straight answers about replacing windows in Bend and Central Oregon." />
  <meta name="twitter:image" content="${SITE}/photos/andersen/andersen-100-room.jpg" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Peak View Windows & Doors Journal",
    "description": "Window replacement guides and advice for Central Oregon homeowners.",
    "url": "${SITE}/blog",
    "publisher": {
      "@type": "Organization",
      "name": "Peak View Windows & Doors",
      "logo": {"@type": "ImageObject", "url": "${SITE}/logo.png"}
    }
  }
  </script>
${live.length ? `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": [
${itemList}
    ]
  }
  </script>
` : ''}
  <link rel="stylesheet" href="/styles.css?v=12" />
  <link rel="icon" type="image/png" href="/logo.png" />
</head>
<body>

${nav('blog', prefix)}

<!-- PAGE HERO -->
<header class="page-hero page-hero--center" aria-labelledby="page-h1">
  <div class="container">
    <p class="eyebrow">The Journal &nbsp;·&nbsp; Bend, Oregon</p>
    <h1 id="page-h1">Window Replacement, Explained</h1>
    <p>Straight answers about replacing windows in Central Oregon — what our climate does to them, which products hold up, and what actually moves the needle on comfort and energy bills.</p>
  </div>
</header>

<!-- POSTS -->
<section aria-label="Articles" style="padding:clamp(3rem,6vw,5rem) 0">
  <div class="container">
    <div class="blog-grid${live.length < 3 ? ' blog-grid--few' : ''}">
${cards}
    </div>
  </div>
</section>

${ctaBand(prefix)}

${footer(prefix)}
</body>
</html>
`;
}
