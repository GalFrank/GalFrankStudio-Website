// Contact form endpoint for galfrank.com (POST /api/contact).
// Cloudflare serves the site's static files first; only requests that match no file reach this Worker.
// Each inquiry is emailed to CONTACT_TO through the EMAIL binding (see wrangler.jsonc). Sending to an
// address verified in Email Routing is free on the Workers Free plan.

const LIMITS = { name: 100, phone: 40, email: 200, type: 100, budget: 100, message: 4000 };
const MAX_BODY = 20000; // bytes
const MIN_FILL_MS = 2000; // faster than a person can fill the form

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/contact") return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });

    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ ok: false, error: "forbidden" }, 403);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: "too_large" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ ok: false, error: "bad_request" }, 400); }
    if (!body || typeof body !== "object") return json({ ok: false, error: "bad_request" }, 400);

    const lead = readLead(body);
    // Spam bots fill the hidden field or submit instantly: answer "ok" so they don't retry, send nothing.
    if (lead.bot) return json({ ok: true });
    const problem = validate(lead);
    if (problem) return json({ ok: false, error: problem }, 422);

    // Say what is missing / what Cloudflare answered, so a failed test shows the cause (no secrets in either).
    if (!env.EMAIL || !env.CONTACT_TO) return json({ ok: false, error: "email_not_configured", missing: [!env.EMAIL && "EMAIL binding", !env.CONTACT_TO && "CONTACT_TO"].filter(Boolean) }, 503);
    try {
      await env.EMAIL.send(buildEmail(lead, env));
      return json({ ok: true });
    } catch (e) {
      console.error("contact form send failed", e && e.code, e && e.message);
      return json({ ok: false, error: "send_failed", code: (e && e.code) || "unknown", detail: String((e && e.message) || "").slice(0, 200) }, 502);
    }
  },
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}

const text = (v, max) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const line = (v, max) => text(v, max).replace(/\s+/g, " ");

export function readLead(b) {
  const elapsed = Number(b.elapsed);
  return {
    name: line(b.name, LIMITS.name),
    phone: line(b.phone, LIMITS.phone),
    email: line(b.email, LIMITS.email),
    type: line(b.type, LIMITS.type),
    budget: line(b.budget, LIMITS.budget),
    message: text(b.message, LIMITS.message),
    lang: b.lang === "en" ? "en" : "he",
    bot: line(b.hp_note, 200) !== "" || (elapsed > 0 && elapsed < MIN_FILL_MS),
  };
}

export function validate(l) {
  if (!l.name) return "name";
  const digits = l.phone.replace(/\D/g, "").length;
  if (digits < 9 || digits > 15) return "phone";
  if (l.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email)) return "email";
  if (l.message.length < 5) return "message";
  return null;
}

// Israeli local numbers (050-1234567) become international for a wa.me link.
function waNumber(phone) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "972" + d.slice(1);
  return d;
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function buildEmail(l, env) {
  const rows = [
    ["שם", l.name],
    ["טלפון", l.phone],
    ["אימייל", l.email || "—"],
    ["סוג הפרויקט", l.type || "—"],
    ["תקציב משוער", l.budget || "—"],
    ["שפת האתר", l.lang === "en" ? "English" : "עברית"],
  ];
  const wa = "https://wa.me/" + waNumber(l.phone);
  const textBody = rows.map(([k, v]) => k + ": " + v).join("\n") + "\n\n" + l.message + "\n\nוואטסאפ: " + wa + "\n";
  const htmlBody =
    '<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#121319">' +
    '<h2 style="margin:0 0 12px;font-size:18px">פנייה חדשה מהאתר</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows.map(([k, v]) => '<tr><td style="color:#5C5F6B;white-space:nowrap">' + k + "</td><td><b>" + escapeHtml(v) + "</b></td></tr>").join("") +
    "</table>" +
    '<p style="margin:16px 0;white-space:pre-wrap;border-inline-start:3px solid #0479BA;padding-inline-start:12px">' + escapeHtml(l.message) + "</p>" +
    '<p><a href="' + wa + '" style="color:#0479BA">השיבו בוואטסאפ ←</a></p></div>';
  const msg = {
    to: String(env.CONTACT_TO).trim().toLowerCase(), // Cloudflare compares with the verified address letter for letter
    from: { email: env.CONTACT_FROM || "website@galfrank.com", name: "GalFrankStudio website" },
    subject: "פנייה חדשה מהאתר: " + l.name,
    text: textBody,
    html: htmlBody,
  };
  if (l.email) msg.replyTo = { email: l.email, name: l.name };
  return msg;
}
