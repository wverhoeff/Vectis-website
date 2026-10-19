// Contact form handler: POST /api/contact (called from worker/index.js)
// Checks the enquiry, verifies the Turnstile anti-bot token, then emails it
// to CONTACT_TO through Resend. Secrets live in Cloudflare, never in the page.
//
// Environment (Cloudflare > Workers & Pages > vectis-website > Settings > Variables and Secrets):
//   RESEND_API_KEY        secret   Resend API key
//   TURNSTILE_SECRET_KEY  secret   Turnstile widget secret
//   CONTACT_TO            text     where enquiries go, e.g. mark@vectisadvisory.co.nz
//   CONTACT_FROM          text     verified sender, e.g. Vectis website <website@vectisadvisory.co.nz>

const LIMITS = { name: 120, email: 200, company: 160, phone: 40, topic: 80, message: 5000 };
const TOPICS = ['Strategy and direction', 'Tools and implementation', 'Learning and adoption', 'Something else'];
const EMAIL_RE = /^[^\s@<>()",;:]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export async function onRequestPost(context) {
  const { request, env } = context;
  const wantsHtml = !(request.headers.get('accept') || '').includes('application/json');
  const reply = (status, body) => !wantsHtml ? json(status, body)
    : status === 200 ? Response.redirect(new URL('/thanks/', request.url).toString(), 303)
    : page(status, body.error);

  // Only accept posts from this site.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { ok: false, error: 'Forbidden.' });

  if ((Number(request.headers.get('content-length')) || 0) > 20000) return reply(413, { ok: false, error: 'That message is too long.' });

  let data;
  try {
    const type = request.headers.get('content-type') || '';
    data = type.includes('application/json') ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return reply(400, { ok: false, error: 'We could not read that form. Please try again.' });
  }

  // Bots fill the hidden field; quietly pretend it worked.
  if (clean(data.website)) return reply(200, { ok: true });

  const form = {
    name: clean(data.name), email: clean(data.email).toLowerCase(), company: clean(data.company),
    phone: clean(data.phone), topic: clean(data.topic), message: clean(data.message, true),
  };
  const errors = validate(form);
  if (Object.keys(errors).length) return reply(422, { ok: false, error: 'Please check the highlighted fields.', fields: errors });

  if (env.TURNSTILE_SECRET_KEY) {
    const passed = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, clean(data['cf-turnstile-response']), request.headers.get('cf-connecting-ip'));
    if (!passed) return reply(403, { ok: false, error: 'We could not confirm you are human. Please try again.' });
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) {
    console.error('Contact form is not configured: set RESEND_API_KEY, CONTACT_TO and CONTACT_FROM.');
    return reply(503, { ok: false, error: 'The form is not available right now. Please try again later.' });
  }

  const sent = await sendEmail(env, form);
  if (!sent) return reply(502, { ok: false, error: 'Your message did not send. Please try again in a moment.' });
  return reply(200, { ok: true });
}

export function onRequest() {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}

function clean(value, multiline = false) {
  if (typeof value !== 'string') return '';
  const v = value.replace(/\u0000/g, '').trim();
  return multiline ? v.replace(/\r\n?/g, '\n') : v.replace(/[\r\n\t]+/g, ' ');
}

export function validate(f) {
  const e = {};
  if (!f.name) e.name = 'Please enter your name.';
  if (!f.email || !EMAIL_RE.test(f.email)) e.email = 'Please enter a valid email address.';
  if (f.phone && !/^[0-9+()\-.\s]{6,}$/.test(f.phone)) e.phone = 'Please check this phone number.';
  if (f.topic && !TOPICS.includes(f.topic)) e.topic = 'Please choose an option.';
  if (!f.message || f.message.length < 10) e.message = 'Please tell us a little about what you need.';
  for (const [k, max] of Object.entries(LIMITS)) if (f[k] && f[k].length > max) e[k] = `Please keep this under ${max} characters.`;
  return e;
}

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret); body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const out = await r.json();
    return out.success === true;
  } catch { return false; }
}

const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendEmail(env, f) {
  const rows = [['Name', f.name], ['Email', f.email], ['Company', f.company], ['Phone', f.phone], ['Interested in', f.topic]].filter(r => r[1]);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nMessage:\n${f.message}\n`;
  const html = `<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:15px;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#456075"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</table>`
    + `<p style="font-family:Arial,sans-serif;font-size:15px;white-space:pre-wrap;margin-top:16px">${esc(f.message)}</p>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: env.CONTACT_TO.split(',').map(s => s.trim()).filter(Boolean),
        reply_to: f.email,
        subject: `Website enquiry from ${f.name}${f.company ? `, ${f.company}` : ''}`.slice(0, 180),
        text, html,
      }),
    });
    if (!r.ok) console.error('Resend error', r.status, await r.text());
    return r.ok;
  } catch (err) {
    console.error('Resend request failed', err);
    return false;
  }
}

// For browsers without JavaScript: a plain page with the problem and a way back.
function page(status, message) {
  const body = `<!doctype html><html lang="en-NZ"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Message not sent | Vectis</title>`
    + `<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050f1a;color:#f1faff;font-family:Arial,sans-serif;padding:24px">`
    + `<main style="max-width:560px"><h1 style="font-size:40px;letter-spacing:-.03em;margin:0 0 16px">Message not sent</h1><p style="font-size:18px;line-height:1.5;color:#b9cfdb">${esc(message)}</p>`
    + `<p><a href="javascript:history.back()" style="display:inline-block;margin-top:16px;padding:16px 26px;border-radius:999px;background:#00eeff;color:#050f1a;font-weight:700;text-decoration:none">Go back to the form</a></p></main></body></html>`;
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
