/**
 * Peak View Windows — Cloudflare Worker
 * Handles POST /api/submit; everything else is served as static assets.
 *
 * Required env vars (Worker → Settings → Variables and secrets):
 *   RESEND_API_KEY              – from resend.com
 *   MY_EMAIL                    – clancy@peakvieworegon.com
 *   CLOUDFLARE_TURNSTILE_SECRET – from Cloudflare Turnstile dashboard
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_API_URL       = 'https://api.resend.com/emails';
const ALLOWED_ORIGIN       = 'https://peakvieworegon.com';

const PROJECT_TYPE_LABELS = {
  'window-replacement': 'Window Replacement',
  'door-replacement':   'Door Replacement',
  'windows-and-doors':  'Windows & Doors',
  'millwork-trim':      'Millwork / Trim Only',
  'not-sure':           'Not Sure Yet',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/submit') {
      if (request.method === 'OPTIONS') return handleOptions();
      if (request.method === 'POST')    return handleSubmit(request, env);
      return new Response('Method not allowed', { status: 405 });
    }

    // All other routes → static assets
    return env.ASSETS.fetch(request);
  },
};

// ─── Form submission handler ──────────────────────────────────────────────────

async function handleSubmit(request, env) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders() };

  let body;
  try {
    body = await request.json();
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

  try {
    const [confirmResult, notifyResult] = await Promise.allSettled([
      sendEmail(env.RESEND_API_KEY, {
        from:    'Peak View Windows & Doors <hello@peakvieworegon.com>',
        to:      safe.email,
        subject: 'We received your estimate request — Peak View Windows & Doors',
        html:    buildCustomerEmail(safe, projectLabel),
      }),
      sendEmail(env.RESEND_API_KEY, {
        from:    'Peak View Website <hello@peakvieworegon.com>',
        to:      env.MY_EMAIL,
        subject: `New estimate request from ${safe.name}`,
        html:    buildOwnerEmail(safe, projectLabel),
      }),
    ]);

    if (confirmResult.status === 'rejected') console.error('Customer email failed:', confirmResult.reason);
    if (notifyResult.status  === 'rejected') console.error('Owner email failed:',    notifyResult.reason);

    if (notifyResult.status === 'rejected') {
      return json({ success: false, error: 'Failed to send — please call or text us at 541-639-3968.' }, 500, headers);
    }

    return json({ success: true }, 200, headers);
  } catch (err) {
    console.error('Email error:', err);
    return json({ success: false, error: 'Failed to send — please call or text us at 541-639-3968.' }, 500, headers);
  }
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
    console.warn('CLOUDFLARE_TURNSTILE_SECRET not set.');
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

async function sendEmail(apiKey, { from, to, subject, html }) {
  const res = await fetch(RESEND_API_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
  return res.json();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildCustomerEmail({ name, phone, email, message }, projectLabel) {
  const firstName  = name.split(' ')[0];
  const messageRow = message
    ? `<tr><td class="label">Message</td><td>${escHtml(message).replace(/\n/g, '<br>')}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Estimate Request Received</title>
<style>
  body{margin:0;padding:0;background:#F2EBE0;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{background:#F2EBE0;padding:40px 16px}
  .card{max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E0D8CF}
  .logo-wrap{padding:40px 40px 28px;text-align:center;background:#FFFFFF}
  .logo-wrap img{display:block;margin:0 auto;height:80px;width:auto}
  .bd{padding:0 40px 40px;background:#FFFFFF;color:#111}
  h1{font-size:22px;font-weight:700;margin:0 0 10px;color:#111}
  .sub{font-size:15px;color:#4A4035;margin:0 0 28px;line-height:1.65}
  .box{background:#F2EBE0;border:1px solid #E0D8CF;margin-bottom:32px;padding:20px 24px}
  .eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A6E64;display:block;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  td{padding:6px 0;font-size:14px;vertical-align:top}
  td.label{color:#4A4035;font-weight:600;width:110px}
  .contact-block{background:#F2EBE0;border:1px solid #E0D8CF;padding:20px 24px;text-align:center}
  .contact-block p{margin:0 0 6px;font-size:14px;color:#4A4035;line-height:1.6}
  .contact-block p:last-child{margin:0}
  a.red{color:#8C1D2A;font-weight:700;text-decoration:none}
  a.plain{color:#8C1D2A;text-decoration:none}
  .ft{padding:20px 40px;background:#F2EBE0;border-top:1px solid #E0D8CF;text-align:center}
  .ft p{font-size:12px;color:#7A6E64;margin:0}
  @media(max-width:600px){
    .logo-wrap{padding:28px 20px 20px}
    .bd{padding:0 20px 32px}
    .box{padding:16px}
    .contact-block{padding:16px}
    .ft{padding:16px 20px}
    td.label{width:90px}
  }
</style>
</head>
<body><div class="wrap"><div class="card">
  <div class="logo-wrap"><img src="https://peakvieworegon.com/logo.png" alt="Peak View Windows &amp; Doors" /></div>
  <div class="bd">
    <h1>Got it, ${escHtml(firstName)}.</h1>
    <p class="sub">Thanks for reaching out. We will personally review your request and get back to you — usually same day.</p>
    <div class="box">
      <span class="eyebrow">Your Submission</span>
      <table>
        <tr><td class="label">Name</td><td>${escHtml(name)}</td></tr>
        <tr><td class="label">Phone</td><td>${escHtml(phone)}</td></tr>
        <tr><td class="label">Email</td><td>${escHtml(email)}</td></tr>
        <tr><td class="label">Project</td><td>${escHtml(projectLabel)}</td></tr>
        ${messageRow}
      </table>
    </div>
    <div class="contact-block">
      <p>In the meantime, reach us directly:</p>
      <p><a href="tel:+15416393968" class="red">541-639-3968</a> &nbsp;·&nbsp; call or text</p>
      <p><a href="mailto:clancy@peakvieworegon.com" class="plain">clancy@peakvieworegon.com</a></p>
    </div>
  </div>
  <div class="ft"><p>Peak View Windows &amp; Doors &nbsp;·&nbsp; Bend, Oregon &nbsp;·&nbsp; CCB #260230</p></div>
</div></div></body></html>`;
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
