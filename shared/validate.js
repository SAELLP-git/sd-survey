import { QUESTIONS, isHabit, questionById, wantsContact } from "./survey.js";

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function emptyRecord(partial = {}) {
  return {
    status: "completed",
    buyer: "",
    q1: "",
    qNameEmail: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: [],
    q6Other: "",
    q7: [],
    q7Other: "",
    q8: [],
    q8Other: "",
    q9: "",
    q10: "",
    q11: "",
    q12: "",
    q13: [],
    q14: "",
    q14Other: "",
    q15: "",
    q16: [],
    q16Other: "",
    q17: "",
    q18: "",
    q19: "",
    q20: "",
    q20Other: "",
    q21: "",
    q22: "",
    q23: [],
    q23Other: "",
    q24: "",
    name: "",
    contact: "",
    idempotencyKey: "",
    ...partial,
  };
}

function fail(error) {
  return { ok: false, error };
}

function includesChoice(value, option) {
  return Array.isArray(value) ? value.includes(option) : value === option;
}

function readQuestion(question, answers) {
  const patch = {};

  if (question.type === "text") {
    const text = clean(answers[question.id], question.maxLength || 160);
    if (!text) {
      return question.required
        ? fail(question.requiredMessage || "This answer is required.")
        : { ok: true, patch: { [question.id]: "" } };
    }
    if (text.length < 2) return fail(question.requiredMessage || "Add a little more detail.");
    return { ok: true, patch: { [question.id]: text } };
  }

  if (question.type === "scale") {
    const n = Number(answers[question.id]);
    if (!Number.isInteger(n) || n < question.min || n > question.max) {
      return fail("Choose a score from 1 to 5.");
    }
    return { ok: true, patch: { [question.id]: n } };
  }

  if (question.type === "multi") {
    const raw = answers[question.id];
    if (raw == null || (Array.isArray(raw) && raw.length === 0)) {
      if (question.other) patch[question.other.key] = "";
      patch[question.id] = [];
      return question.required ? fail("Choose at least one answer.") : { ok: true, patch };
    }
    if (!Array.isArray(raw)) return fail("Choose one of the listed answers.");
    if (raw.length > (question.max || 3)) {
      return fail(`You can choose up to ${question.max || 3}.`);
    }
    const selected = [];
    for (const item of raw) {
      const value = clean(item, 160);
      if (!question.options.includes(value)) return fail("Choose one of the listed answers.");
      if (!selected.includes(value)) selected.push(value);
    }
    const exclusive = question.exclusive || [];
    const exclusiveHit = selected.filter((value) => exclusive.includes(value));
    if (exclusiveHit.length && selected.length > 1) {
      return fail(`Select “${exclusiveHit[0]}” on its own.`);
    }
    patch[question.id] = selected;
    const otherCheck = applyOther(question, selected, answers, patch);
    if (!otherCheck.ok) return otherCheck;
    return { ok: true, patch };
  }

  const value = clean(answers[question.id], 180);
  if (!value) {
    if (question.other) patch[question.other.key] = "";
    patch[question.id] = "";
    return question.required ? fail("Choose an answer to continue.") : { ok: true, patch };
  }
  if (!question.options.includes(value)) return fail("Choose one of the listed answers.");
  patch[question.id] = value;
  const otherCheck = applyOther(question, value, answers, patch);
  if (!otherCheck.ok) return otherCheck;
  return { ok: true, patch };
}

function applyOther(question, selected, answers, patch) {
  if (!question.other) return { ok: true };
  if (!includesChoice(selected, question.other.option)) {
    patch[question.other.key] = "";
    return { ok: true };
  }
  if (question.other.numeric) {
    const n = Number(clean(String(answers[question.other.key] ?? ""), 8));
    if (!Number.isInteger(n) || n < 0 || n > 99) {
      return fail("Enter a whole number of bottles from 0 to 99.");
    }
    patch[question.other.key] = String(n);
    return { ok: true };
  }
  const text = clean(answers[question.other.key], question.other.max || 160);
  if (!text) return fail("Tell us a bit more about your “Other” answer.");
  patch[question.other.key] = text;
  return { ok: true };
}

export function validateOne(id, answers) {
  const question = questionById(id);
  if (!question) return fail("That question is not part of this survey.");
  if (isHabit(id) && answers?.q4 === "No") return { ok: true, patch: {} };
  const result = readQuestion(question, answers || {});
  if (!result.ok) return result;
  if (id === "q24" && wantsContact(result.patch.q24)) {
    const contact = clean(answers.contact, 120);
    if (contact && contact.length < 5) {
      return fail("Enter a phone number or email, or leave it blank.");
    }
  }
  return result;
}

export function validateAnswers(raw) {
  const answers = raw && typeof raw === "object" ? raw : {};
  const first = readQuestion(questionById("q1"), answers);
  if (!first.ok) return first;

  if (first.patch.q1 === "Under 18") {
    return {
      ok: true,
      record: emptyRecord({ status: "screened_out", q1: "Under 18", buyer: "" }),
    };
  }

  const record = emptyRecord({ status: "completed", ...first.patch });
  for (const question of QUESTIONS) {
    if (question.id === "q1") continue;
    if (isHabit(question.id) && record.q4 !== "Yes") continue;
    const result = readQuestion(question, answers);
    if (!result.ok) return result;
    Object.assign(record, result.patch);
  }

  if (wantsContact(record.q24)) {
    record.name = clean(answers.name, 80);
    record.contact = clean(answers.contact, 120);
    if (record.contact && record.contact.length < 5) {
      return fail("Enter a phone number or email, or leave it blank.");
    }
  } else {
    record.name = "";
    record.contact = "";
  }

  record.buyer = record.q4 === "Yes" ? "Yes" : "No";
  return { ok: true, record };
}
