// Contact form Worker tests. Run from the repo root: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { readLead, validate, buildEmail } from "../worker/index.js";

const SITE = "https://galfrank.com";
const good = { name: "ישראל ישראלי", phone: "050-1234567", email: "client@example.com", type: "רילס וסושיאל", budget: "עד ₪3,000", message: "צריך רילס לאינסטגרם", lang: "he", hp_note: "", elapsed: 15000 };

function envWithMailbox() {
  const sent = [];
  return { sent, env: { CONTACT_TO: "owner@example.com", CONTACT_FROM: "website@galfrank.com", EMAIL: { send: async (m) => { sent.push(m); return { messageId: "m1" }; } } } };
}
const post = (body, headers = {}) => new Request(SITE + "/api/contact", { method: "POST", headers: { "content-type": "application/json", origin: SITE, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("valid inquiry is emailed with every field", async () => {
  const { env, sent } = envWithMailbox();
  const res = await worker.fetch(post(good), env);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.equal(m.to, "owner@example.com");
  assert.equal(m.from.email, "website@galfrank.com");
  assert.deepEqual(m.replyTo, { email: "client@example.com", name: "ישראל ישראלי" });
  assert.match(m.subject, /ישראל ישראלי/);
  for (const v of [good.name, good.phone, good.email, good.type, good.budget, good.message]) { assert.ok(m.text.includes(v), "text has " + v); }
  assert.match(m.text, /wa\.me\/972501234567/);
  assert.match(m.html, /dir="rtl"/);
});

test("html in the message is escaped and the subject stays on one line", async () => {
  const { env, sent } = envWithMailbox();
  await worker.fetch(post({ ...good, name: "Eve\r\nBcc: x@y.z", message: "<script>alert(1)</script> hi" }), env);
  assert.ok(!sent[0].html.includes("<script>"));
  assert.ok(!/[\r\n]/.test(sent[0].subject));
});

test("no email address means no reply-to", () => {
  const m = buildEmail(readLead({ ...good, email: "" }), { CONTACT_TO: "o@example.com" });
  assert.equal(m.replyTo, undefined);
  assert.equal(m.from.email, "website@galfrank.com");
});

test("honeypot or instant submits look successful but send nothing", async () => {
  for (const body of [{ ...good, hp_note: "http://spam" }, { ...good, elapsed: 300 }]) {
    const { env, sent } = envWithMailbox();
    const res = await worker.fetch(post(body), env);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(sent.length, 0);
  }
});

test("invalid input is rejected with the failing field", async () => {
  const cases = [[{ name: "" }, "name"], [{ phone: "123" }, "phone"], [{ email: "nope" }, "email"], [{ message: "hi" }, "message"]];
  for (const [patch, field] of cases) {
    const { env, sent } = envWithMailbox();
    const res = await worker.fetch(post({ ...good, ...patch }), env);
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { ok: false, error: field });
    assert.equal(sent.length, 0);
  }
});

test("without the email binding the form is told to fall back", async () => {
  const res = await worker.fetch(post(good), { CONTACT_TO: "owner@example.com" });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.deepEqual(body.missing, ["EMAIL binding"]);
});

test("a failed send is reported, not hidden", async () => {
  const env = { CONTACT_TO: "o@example.com", EMAIL: { send: async () => { const e = new Error("nope"); e.code = "E_SENDER_NOT_VERIFIED"; throw e; } } };
  const orig = console.error; console.error = () => {};
  try {
    const res = await worker.fetch(post(good), env);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "E_SENDER_NOT_VERIFIED", "the cause is reported");
  } finally { console.error = orig; }
});

test("wrong method, other paths, other origins and junk bodies are refused", async () => {
  const { env, sent } = envWithMailbox();
  assert.equal((await worker.fetch(new Request(SITE + "/api/contact"), env)).status, 405);
  assert.equal((await worker.fetch(new Request(SITE + "/nope"), env)).status, 404);
  assert.equal((await worker.fetch(post(good, { origin: "https://evil.example" }), env)).status, 403);
  assert.equal((await worker.fetch(post("{not json"), env)).status, 400);
  assert.equal((await worker.fetch(post("x".repeat(30000)), env)).status, 413);
  assert.equal(sent.length, 0);
});

test("phone numbers become WhatsApp numbers", () => {
  const wa = (phone) => buildEmail(readLead({ ...good, phone }), { CONTACT_TO: "o@example.com" }).text.match(/wa\.me\/(\d+)/)[1];
  assert.equal(wa("050-1234567"), "972501234567");
  assert.equal(wa("+972 50 123 4567"), "972501234567");
  assert.equal(wa("00972501234567"), "972501234567");
  assert.equal(validate(readLead({ ...good, phone: "+1 (415) 555-0100" })), null);
});
