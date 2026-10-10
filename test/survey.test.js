import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { COPY, QUESTIONS, SURVEY_VERSION, buildPath } from "../shared/survey.js";
import { summarize } from "../shared/stats.js";
import { validateAnswers } from "../shared/validate.js";
import { createApp } from "../server/index.js";
import { createStore } from "../server/store.js";

function buyerAnswers(overrides = {}) {
  return {
    q1: "25–34",
    q2: "Andheri, Mumbai",
    q3: "₹60k–₹1L",
    q4: "Yes",
    q5: "Weekly",
    q6: ["Juice", "Other"],
    q6Other: "Sugarcane juice",
    q7: ["Supermarket", "Kirana store"],
    q8: ["Taste", "Low sugar"],
    q9: "Sometimes",
    q10: ["Indian tradition"],
    q11: 4,
    q12: ["Refreshment"],
    q13: "Light and refreshing",
    q14: "Saffron + cardamom",
    q15: "Lightly sweet",
    q16: "Still",
    q17: "Can",
    q18: "₹60–₹79",
    q19: "Fair",
    q20: "4 — Probably yes",
    q21: "3–5",
    q22: "Weekly",
    q23: "F — Refreshing",
    q24: ["Better taste"],
    q25: ["Want to taste first"],
    q26: "A clearer saffron aroma",
    q27: "Yes — tastings",
    name: "Asha",
    contact: "asha@example.com",
    ...overrides,
  };
}

test("the 27-question path skips habits and low purchase intent", () => {
  assert.equal(QUESTIONS.length, 27);
  assert.equal(buildPath({ q1: "18–24", q4: "Yes", q20: "4 — Probably yes" }).length, 27);
  assert.equal(buildPath({ q1: "18–24", q4: "No" }).includes("q5"), false);
  assert.equal(buildPath({ q1: "18–24", q4: "No", q20: "5 — Definitely yes" }).length, 23);
  assert.equal(buildPath({ q1: "18–24", q4: "Yes", q20: "1 — Definitely not" }).includes("q21"), false);
  assert.deepEqual(buildPath({ q1: "Under 18" }), ["q1"]);
  assert.equal(COPY.concept.includes("water-based"), true);
  for (const question of QUESTIONS) {
    assert.ok((question.options || []).length <= 10, `${question.id} has too many options`);
  }
});

test("under 18 ends without profile answers", () => {
  const result = validateAnswers({ q1: "Under 18" });
  assert.equal(result.ok, true);
  assert.equal(result.record.status, "screened_out");
  assert.equal(result.record.q2, "");
  assert.equal(result.record.surveyVersion, SURVEY_VERSION);
});

test("non-buyers and people unlikely to buy can finish the shorter path", () => {
  const nonBuyer = validateAnswers(buyerAnswers({ q4: "No", q5: "", q6: [], q7: [], q8: [] }));
  assert.equal(nonBuyer.ok, true);
  assert.deepEqual(nonBuyer.record.q6, []);

  const unlikely = validateAnswers(buyerAnswers({ q20: "2 — Probably not", q21: "6–10", q22: "Daily" }));
  assert.equal(unlikely.ok, true);
  assert.equal(unlikely.record.q21, "");
  assert.equal(unlikely.record.q22, "");
});

test("rejects too many drinks and combined exclusive answers", () => {
  const tooMany = validateAnswers(
    buyerAnswers({ q6: ["Juice", "Coconut water", "Iced tea / cold coffee", "Soda / soft drinks"] }),
  );
  assert.equal(tooMany.ok, false);
  const mixed = validateAnswers(buyerAnswers({ q25: ["Price", "Nothing"] }));
  assert.equal(mixed.ok, false);
});

test("summary keeps buyers apart and ignores contact without permission", () => {
  const buyer = validateAnswers(buyerAnswers()).record;
  const nonBuyer = validateAnswers(
    buyerAnswers({
      q1: "45–54",
      q2: "Pune, Kothrud",
      q4: "No",
      q11: 2,
      q19: "Too expensive",
      q20: "2 — Probably not",
      q27: "No",
      name: "Should not save",
      contact: "secret@example.com",
    }),
  ).record;
  assert.equal(nonBuyer.name, "");
  assert.equal(buyer.q23Code, "F");
  const stats = summarize([
    { ...buyer, id: "a", status: "completed" },
    { ...nonBuyer, id: "b", status: "completed" },
    { id: "c", status: "screened_out", q1: "Under 18", surveyVersion: SURVEY_VERSION },
  ]);
  assert.equal(stats.global.completed, 2);
  assert.equal(stats.global.screened, 1);
  assert.equal(stats.split.buyers.appealTop2Pct, 100);
  assert.equal(stats.split.nonBuyers.intentTop2Pct, 0);
  assert.equal(stats.global.priceAccept, 1);
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
    const listed = await store.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].q2, "Andheri, Mumbai");
    assert.equal(listed[0].surveyVersion, SURVEY_VERSION);

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
