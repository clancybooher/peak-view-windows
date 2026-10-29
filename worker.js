/**
 * Peak View Windows — Cloudflare Worker
 * Canonical redirects, then static assets.
 *
 * Deploy:
 *   npx wrangler deploy
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const scheme = (() => {
      const visitor = request.headers.get('cf-visitor');
      if (visitor) {
        try { return JSON.parse(visitor).scheme; } catch { /* ignore */ }
      }
      return request.headers.get('x-forwarded-proto') || url.protocol.replace(':','');
    })();
    if (scheme === 'http') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    if (url.hostname === 'www.peakvieworegon.com') {
      return Response.redirect('https://peakvieworegon.com' + url.pathname + url.search, 301);
    }

    if (url.pathname === '/index.html') {
      return Response.redirect('https://' + url.hostname + '/' + url.search, 301);
    }

    if (url.pathname.endsWith('.html') && url.pathname !== '/404.html') {
      const pretty = url.pathname.slice(0, -5);
      return Response.redirect('https://' + url.hostname + pretty + url.search, 301);
    }

    return env.ASSETS.fetch(request);
  },
};
