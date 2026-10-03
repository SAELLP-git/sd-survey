import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { COPY, QUESTIONS, buildPath } from "../shared/survey.js";
import { summarize } from "../shared/stats.js";
import { validateAnswers } from "../shared/validate.js";
import { createApp } from "../server/index.js";
import { createStore } from "../server/store.js";

function buyerAnswers(overrides = {}) {
  return {
    q1: "25–34",
    qNameEmail: "Asha",
    q2: "Andheri, Mumbai",
    q3: "₹60,000–99,999",
    q4: "Yes",
    q5: "About once a week",
    q6: ["Iced tea", "Other"],
    q6Other: "Sugarcane juice",
    q7: ["Quick-commerce app", "Supermarket"],
    q8: ["Taste", "Low sugar"],
    q9: "₹50–69",
    q10: "Mildly sweet",
    q11: "Yes, occasionally",
    q12: 4,
    q13: ["After exercise", "An occasional treat"],
    q14: "Saffron + cardamom",
    q15: "250 ml",
    q16: ["Need to taste it first"],
    q17: "Below ₹30",
    q18: "₹60–79",
    q19: "4 — Probably would buy",
    q20: "2",
    q21: "3–5",
    q22: "Single bottle",
    q23: ["Traditional"],
    q24: "Yes—tasting or sample opportunities only",
    name: "Asha",
    contact: "asha@example.com",
    ...overrides,
  };
}

test("buyer path includes the optional identity field and non-buyers skip habits", () => {
  assert.equal(QUESTIONS.length, 25);
  assert.equal(buildPath({ q1: "18–24", q4: "Yes" }).length, 25);
  assert.equal(buildPath({ q1: "18–24", q4: "No" }).includes("q5"), false);
  assert.equal(buildPath({ q1: "18–24", q4: "No" }).length, 19);
  assert.deepEqual(buildPath({ q1: "Under 18" }), ["q1"]);
  assert.equal(COPY.concept.includes("immunity"), false);
  assert.equal(COPY.concept.includes("lightly carbonated"), true);
  assert.equal(COPY.intro.includes("not interested"), true);
});

test("under 18 ends without profile answers", () => {
  const result = validateAnswers({ q1: "Under 18" });
  assert.equal(result.ok, true);
  assert.equal(result.record.status, "screened_out");
  assert.equal(result.record.q2, "");
});

test("non-buyers can finish without habit answers", () => {
  const answers = buyerAnswers({ q4: "No", q5: "", q6: [], q7: [], q8: [], q9: "", q10: "" });
  const result = validateAnswers(answers);
  assert.equal(result.ok, true);
  assert.equal(result.record.buyer, "No");
  assert.deepEqual(result.record.q6, []);
});

test("rejects too many drinks and combined exclusive answers", () => {
  const tooMany = validateAnswers(buyerAnswers({ q6: ["Iced tea", "Juice or fruit drinks", "Kombucha", "Coconut water"] }));
  assert.equal(tooMany.ok, false);
  const mixed = validateAnswers(buyerAnswers({ q16: ["Price", "No particular concern"] }));
  assert.equal(mixed.ok, false);
});

test("summary keeps buyers apart and does not require contact", () => {
  const buyer = validateAnswers(buyerAnswers()).record;
  const nonBuyer = validateAnswers(
    buyerAnswers({
      q1: "45–54",
      q2: "Pune, Kothrud",
      q4: "No",
      q12: 2,
      q19: "2 — Probably would not buy",
      q24: "No, please do not contact me",
      name: "Should not save",
      contact: "secret@example.com",
    }),
  ).record;
  assert.equal(nonBuyer.name, "");
  const stats = summarize([
    { ...buyer, id: "a", status: "completed" },
    { ...nonBuyer, id: "b", status: "completed" },
    { id: "c", status: "screened_out", q1: "Under 18" },
  ]);
  assert.equal(stats.global.completed, 2);
  assert.equal(stats.global.screened, 1);
  assert.equal(stats.split.buyers.n, 1);
  assert.equal(stats.split.nonBuyers.meanAppeal, 2);
  assert.equal(stats.global.reachable, 1);
  assert.equal(stats.contacts.length, 1);
  assert.equal(stats.contacts[0].name, "Asha");
});

test("responses append to excel and the dashboard stays locked", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "sip-survey-"));
  process.env.DASHBOARD_PASSWORD = "test-code-123";
  const store = await createStore(dir);
  const app = createApp(store);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const port = server.address().port;
  try {
    const denied = await fetch(`http://127.0.0.1:${port}/api/responses`);
    assert.equal(denied.status, 401);

    const saved = await fetch(`http://127.0.0.1:${port}/api/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "test-key-001", answers: buyerAnswers() }),
    });
    assert.equal(saved.status, 201);

    const again = await fetch(`http://127.0.0.1:${port}/api/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "test-key-001", answers: buyerAnswers({ q2: "Delhi" }) }),
    });
    assert.equal(again.status, 201);
    const listed = await store.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].q2, "Andheri, Mumbai");

    const file = await fetch(`http://127.0.0.1:${port}/api/export`, {
      headers: { Authorization: "Bearer test-code-123" },
    });
    assert.equal(file.status, 200);
    const bytes = Buffer.from(await file.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.DASHBOARD_PASSWORD;
    await rm(dir, { recursive: true, force: true });
  }
});
