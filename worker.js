/**
 * Peak View Windows — Cloudflare Worker
 * Handles POST /api/submit; everything else is served as static assets.
 *
 * Required env vars (Cloudflare dashboard → Workers & Pages → peak-view-windows
 *                    → Settings → Variables and secrets):
 *
 *   RESEND_API_KEY              – resend.com → API Keys
 *   MY_EMAIL                    – clancy@peakvieworegon.com
 *   CLOUDFLARE_TURNSTILE_SECRET – dash.cloudflare.com → Turnstile → your site → Secret key
 *
 *   QUO_API_KEY                 – app.openphone.com → Settings → API → your key (sent as bare Authorization header, no Bearer prefix)
 *   QUO_FROM_NUMBER             – your Quo/OpenPhone number in E.164, e.g. +15416393968
 *   MY_PHONE_NUMBER             – your personal number to receive texts, e.g. +15415550000
 *
 * Deploy:
 *   npx wrangler deploy
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_API_URL       = 'https://api.resend.com/emails';
const OPENPHONE_API_URL    = 'https://api.openphone.com/v1/messages';
const ALLOWED_ORIGIN       = 'https://peakvieworegon.com';

const PROJECT_TYPE_LABELS = {
  'whole-home-window-replacement': 'Whole-Home Window Replacement',
  'window-replacement': 'A Few Windows',
  'door-replacement':   'Door Replacement',
  'windows-and-doors':  'Windows & Doors',
  'millwork-trim':      'Millwork / Trim Only',
  'not-sure':           'Not Sure Yet',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonical 301s before /api/submit and ASSETS. Never redirect the form endpoint.
    if (url.pathname !== '/api/submit') {
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
    }

    if (url.pathname === '/api/submit') {
      if (request.method === 'OPTIONS') return handleOptions();
      if (request.method === 'POST')    return handleSubmit(request, env);
      return new Response('Method not allowed', { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};

// ─── Form submission handler ──────────────────────────────────────────────────

async function handleSubmit(request, env) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders() };

  // Parse body — accept both JSON and form-encoded submissions
  let body;
  try {
    const ct = request.headers.get('Content-Type') ?? '';
    if (ct.includes('application/x-www-form-urlencoded')) {
      const text   = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await request.json();
    }
  } catch {
    return json({ success: false, error: 'Invalid request.' }, 400, headers);
  }

  const { name, phone, email, project_type, message, turnstileToken } = body;

  const validationError = validateInputs({ name, phone, email, project_type, turnstileToken });
  if (validationError) return json({ success: false, error: validationError }, 422, headers);

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const turnstileOk = await verifyTurnstile(turnstileToken, ip, env.CLOUDFLARE_TURNSTILE_SECRET);
  if (!turnstileOk) {
    return json({ success: false, error: 'Security check failed. Please refresh and try again.' }, 422, headers);
  }

  const safe = {
    name:         sanitize(name),
    phone:        sanitize(phone),
    email:        sanitize(email),
    project_type: sanitize(project_type),
    message:      sanitize(message ?? ''),
  };
  const projectLabel = PROJECT_TYPE_LABELS[safe.project_type] ?? safe.project_type;

  // Fire all three notifications in parallel; any individual failure is logged but
  // never surfaces as an error to the user — the lead is in, that's what matters.
  const [confirmResult, notifyResult, smsResult] = await Promise.allSettled([
    sendEmail(env.RESEND_API_KEY, {
      from:    'Peak View Windows & Doors <hello@peakvieworegon.com>',
      to:      safe.email,
      subject: 'We received your estimate request — Peak View Windows & Doors',
      html:    buildCustomerEmail(safe, projectLabel),
    }),
    sendEmail(env.RESEND_API_KEY, {
      from:    'Peak View Website <hello@peakvieworegon.com>',
      to:      buildNotifyList(env),
      subject: `New estimate request from ${safe.name}`,
      html:    buildOwnerEmail(safe, projectLabel),
    }),
    sendSms(env, safe, projectLabel),
  ]);

  if (confirmResult.status === 'rejected') console.error('Customer email failed:', confirmResult.reason);
  if (notifyResult.status  === 'rejected') console.error('Owner email failed:',    notifyResult.reason);
  if (smsResult.status     === 'rejected') console.error('SMS failed:',            smsResult.reason);

  return json({ success: true }, 200, headers);
}

function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, 2000);
}

function validateInputs({ name, phone, email, project_type, turnstileToken }) {
  if (!name  || !name.trim())  return 'Please enter your name.';
  if (!phone || !phone.trim()) return 'Please enter your phone number.';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
  if (!project_type || !PROJECT_TYPE_LABELS[project_type.trim()])  return 'Please select a valid project type.';
  if (!turnstileToken) return 'Please complete the security check.';
  return null;
}

async function verifyTurnstile(token, ip, secret) {
  if (!secret) {
    console.warn('CLOUDFLARE_TURNSTILE_SECRET not set — skipping.');
    return true;
  }
  try {
    const res  = await fetch(TURNSTILE_VERIFY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile error:', err);
    return false;
  }
}

// Always includes clancybooher@gmail.com as a guaranteed fallback;
// also sends to MY_EMAIL (clancy@peakvieworegon.com) when that secret is set.
function buildNotifyList(env) {
  const addrs = ['clancybooher@gmail.com'];
  if (env.MY_EMAIL && env.MY_EMAIL !== addrs[0]) addrs.push(env.MY_EMAIL);
  return addrs;
}

// ─── Email sending ────────────────────────────────────────────────────────────

async function sendEmail(apiKey, { from, to, subject, html }) {
  if (!apiKey) throw new Error('RESEND_API_KEY not set.');
  const res = await fetch(RESEND_API_URL, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── SMS sending (Quo / OpenPhone) ────────────────────────────────────────────

async function sendSms(env, safe, projectLabel) {
  const { QUO_API_KEY, QUO_FROM_NUMBER, MY_PHONE_NUMBER } = env;

  // Skip silently if any Quo secret is missing — won't throw, just logs.
  if (!QUO_API_KEY || !QUO_FROM_NUMBER || !MY_PHONE_NUMBER) {
    console.warn('Quo SMS skipped: QUO_API_KEY, QUO_FROM_NUMBER, or MY_PHONE_NUMBER not set.');
    return;
  }

  const text = buildSmsMessage(safe, projectLabel);

  const res = await fetch(OPENPHONE_API_URL, {
    method:  'POST',
    headers: {
      'Authorization': QUO_API_KEY,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    QUO_FROM_NUMBER,
      to:      [MY_PHONE_NUMBER],
      content: text,
    }),
  });

  if (!res.ok) throw new Error(`Quo SMS ${res.status}: ${await res.text()}`);
  return res.json();
}

function buildSmsMessage({ name, phone, email, message }, projectLabel) {
  const lines = [
    '🏠 NEW LEAD — Peak View',
    `Name:    ${name}`,
    `Phone:   ${phone}`,
    `Email:   ${email}`,
    `Project: ${projectLabel}`,
  ];
  if (message) lines.push(`Note:    ${message.slice(0, 200)}`);
  return lines.join('\n');
}

// ─── HTML escape helper ───────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildCustomerEmail({ name, phone, email, message }, projectLabel) {
  const firstName  = name.split(' ')[0];
  const messageRow = message
    ? `<tr><td style="padding:5px 0;font-size:14px;color:#4A4035;font-weight:600;vertical-align:top;">Message</td><td style="padding:5px 0;font-size:14px;color:#111111;">${escHtml(message).replace(/\n/g, '<br>')}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Estimate Request Received</title>
</head>
<body style="margin:0;padding:0;background-color:#F2EBE0;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EBE0;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #E0D8CF;">

      <tr>
        <td align="center" style="background-color:#111111;padding:24px 32px;">
          <img src="https://peakvieworegon.com/logo-light.png" alt="Peak View Windows &amp; Doors" height="56" style="display:block;height:56px;width:auto;border:0;" />
        </td>
      </tr>

      <tr>
        <td style="padding:36px 40px 16px;background-color:#ffffff;">
          <h1 style="font-size:22px;font-weight:700;color:#111111;margin:0 0 10px;">Got it, ${escHtml(firstName)}.</h1>
          <p style="font-size:15px;color:#4A4035;line-height:1.65;margin:0 0 28px;">Thanks for reaching out. We will personally review your request and get back to you — usually same day.</p>
        </td>
      </tr>

      <tr>
        <td style="padding:0 40px 28px;background-color:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EBE0;border:1px solid #E0D8CF;">
            <tr>
              <td style="padding:20px 24px;">
                <span style="display:block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A6E64;margin-bottom:14px;">Your Submission</span>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:5px 0;font-size:14px;color:#4A4035;font-weight:600;width:110px;vertical-align:top;">Name</td><td style="padding:5px 0;font-size:14px;color:#111111;">${escHtml(name)}</td></tr>
                  <tr><td style="padding:5px 0;font-size:14px;color:#4A4035;font-weight:600;vertical-align:top;">Phone</td><td style="padding:5px 0;font-size:14px;color:#111111;">${escHtml(phone)}</td></tr>
                  <tr><td style="padding:5px 0;font-size:14px;color:#4A4035;font-weight:600;vertical-align:top;">Email</td><td style="padding:5px 0;font-size:14px;color:#111111;">${escHtml(email)}</td></tr>
                  <tr><td style="padding:5px 0;font-size:14px;color:#4A4035;font-weight:600;vertical-align:top;">Project</td><td style="padding:5px 0;font-size:14px;color:#111111;">${escHtml(projectLabel)}</td></tr>
                  ${messageRow}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 40px 36px;background-color:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EBE0;border:1px solid #E0D8CF;">
            <tr>
              <td align="center" style="padding:20px 24px;">
                <p style="margin:0 0 8px;font-size:14px;color:#4A4035;">In the meantime, reach us directly:</p>
                <p style="margin:0 0 6px;font-size:16px;font-weight:700;"><a href="tel:+15416393968" style="color:#8C1D2A;text-decoration:none;">541-639-3968</a> &nbsp;&middot;&nbsp; <span style="font-size:14px;font-weight:400;color:#4A4035;">call or text</span></p>
                <p style="margin:0;font-size:14px;"><a href="mailto:clancy@peakvieworegon.com" style="color:#8C1D2A;text-decoration:none;">clancy@peakvieworegon.com</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td align="center" style="padding:16px 40px;background-color:#F2EBE0;border-top:1px solid #E0D8CF;">
          <p style="margin:0;font-size:12px;color:#7A6E64;">Peak View Windows &amp; Doors &nbsp;&middot;&nbsp; Bend, Oregon &nbsp;&middot;&nbsp; CCB #260230</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildOwnerEmail({ name, phone, email, message }, projectLabel) {
  const phoneDigits = phone.replace(/\D/g, '');
  const messageRow  = message
    ? `<tr><td class="label">Message</td><td>${escHtml(message).replace(/\n/g, '<br>')}</td></tr>`
    : `<tr><td class="label">Message</td><td style="color:#7A6E64">None provided</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>New Estimate Request</title>
<style>
  body{margin:0;padding:0;background:#F2EBE0;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{background:#F2EBE0;padding:40px 16px}
  .card{max-width:600px;margin:0 auto;background:#fff;border:1px solid #E0D8CF}
  .hd{background:#8C1D2A;padding:18px 32px}
  .hd p{color:#fff;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin:0}
  .bd{padding:32px;color:#111}
  h2{font-size:20px;font-weight:700;margin:0 0 20px}
  table{width:100%;border-collapse:collapse}
  td{padding:10px 0;font-size:14px;vertical-align:top;border-bottom:1px solid #E0D8CF}
  td.label{color:#4A4035;font-weight:600;width:130px}
  a.red{color:#8C1D2A;font-weight:700;text-decoration:none}
  a.plain{color:#8C1D2A;text-decoration:none}
  .ft{padding:16px 32px;background:#F2EBE0;border-top:1px solid #E0D8CF;text-align:center}
  .ft p{font-size:12px;color:#7A6E64;margin:0}
</style>
</head>
<body><div class="wrap"><div class="card">
  <div class="hd"><p>New Lead — Peak View Website</p></div>
  <div class="bd">
    <h2>${escHtml(name)} wants a free estimate</h2>
    <table>
      <tr><td class="label">Name</td><td>${escHtml(name)}</td></tr>
      <tr><td class="label">Phone</td><td><a href="tel:${escHtml(phoneDigits)}" class="red">${escHtml(phone)}</a></td></tr>
      <tr><td class="label">Email</td><td><a href="mailto:${escHtml(email)}" class="plain">${escHtml(email)}</a></td></tr>
      <tr><td class="label">Project</td><td>${escHtml(projectLabel)}</td></tr>
      ${messageRow}
    </table>
  </div>
  <div class="ft"><p>Sent from peakvieworegon.com &nbsp;·&nbsp; Peak View Windows &amp; Doors</p></div>
</div></div></body></html>`;
}
