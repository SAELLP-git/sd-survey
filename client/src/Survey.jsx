import { useEffect, useId, useRef, useState } from "react";
import { COPY, QUESTIONS, buildPath, preambleText, pruneAnswers, questionById, wantsContact } from "@shared/survey.js";
import { validateOne } from "@shared/validate.js";
import { Bottle } from "./Bottle.jsx";

function emptyAnswers() {
  const answers = { name: "", contact: "" };
  for (const question of QUESTIONS) {
    answers[question.id] = question.type === "multi" ? [] : "";
    if (question.other) answers[question.other.key] = "";
  }
  return answers;
}

function choiceOn(selected, option) {
  return Array.isArray(selected) ? selected.includes(option) : selected === option;
}

export function Survey() {
  const [stage, setStage] = useState("intro");
  const [answers, setAnswers] = useState(emptyAnswers);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [startedAt, setStartedAt] = useState("");
  const [positionOrder] = useState(() => {
    const options = questionById("q23").options.slice(0, -1);
    const copy = [...options];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  });
  const titleRef = useRef(null);
  const honeypotId = useId();

  const path = buildPath(answers);
  const question = questionById(path[Math.min(index, path.length - 1)]);
  const ml =
    stage === "thanks" ? 250 : stage === "intro" || stage === "minor" ? 0 : Math.round((index / path.length) * 250);

  useEffect(() => {
    document.title = stage === "thanks" ? "Thank you" : "Help Us Shape a New Saffron Beverage";
  }, [stage]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    titleRef.current?.focus();
  }, [stage, index]);

  function update(recipe) {
    setError("");
    setAnswers((current) => pruneAnswers(recipe(current)));
  }

  function pickSingle(q, option) {
    update((current) => {
      const next = { ...current, [q.id]: option };
      if (q.other && option !== q.other.option) next[q.other.key] = "";
      if (q.id === "q27" && !wantsContact(option)) {
        next.name = "";
        next.contact = "";
      }
      return next;
    });
  }

  function toggleMulti(q, option) {
    const current = Array.isArray(answers[q.id]) ? answers[q.id] : [];
    const exclusive = q.exclusive || [];
    let nextValues;
    if (exclusive.includes(option)) {
      nextValues = current.length === 1 && current[0] === option ? [] : [option];
    } else if (current.includes(option)) {
      nextValues = current.filter((value) => value !== option);
    } else {
      const withoutExclusive = current.filter((value) => !exclusive.includes(value));
      if (withoutExclusive.length >= q.max) {
        setError(`You can choose up to ${q.max}.`);
        return;
      }
      nextValues = [...withoutExclusive, option];
    }
    update((currentAnswers) => {
      const next = { ...currentAnswers, [q.id]: nextValues };
      if (q.other && !nextValues.includes(q.other.option)) next[q.other.key] = "";
      return next;
    });
  }

  async function save(snapshot = answers) {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          startedAt,
          company_website_confirm: honeypot,
          answers: snapshot,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The response could not be saved.");
      setStage(snapshot.q1 === "Under 18" ? "minor" : "thanks");
    } catch (caught) {
      setError(caught.message || "The response could not be saved. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (stage === "intro") {
      setStartedAt(new Date().toISOString());
      setStage("question");
      setIndex(0);
      return;
    }
    const id = path[index];
    const check = validateOne(id, answers);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    if (id === "q1" && answers.q1 === "Under 18") {
      void save();
      return;
    }
    const future = buildPath(answers);
    const position = future.indexOf(id);
    if (position === future.length - 1) {
      void save();
      return;
    }
    setIndex(position + 1);
    setError("");
  }

  function goBack() {
    setError("");
    if (index === 0) {
      setStage("intro");
      return;
    }
    setIndex(index - 1);
  }

  function skip() {
    const q = question;
    const nextAnswers = { ...answers, [q.id]: q.type === "multi" ? [] : "" };
    if (q.other) nextAnswers[q.other.key] = "";
    setAnswers(pruneAnswers(nextAnswers));
    const future = buildPath(nextAnswers);
    const position = future.indexOf(q.id);
    setError("");
    if (position === future.length - 1) {
      void save(nextAnswers);
      return;
    }
    setIndex(position + 1);
  }

  function restart() {
    setAnswers(emptyAnswers());
    setStage("intro");
    setIndex(0);
    setError("");
    setHoneypot("");
    setStartedAt("");
    setIdempotencyKey(crypto.randomUUID());
  }

  const selected = answers[question?.id];
  const showOther = question?.other && choiceOn(selected, question.other.option);
  const atEnd = stage === "question" && index === path.length - 1;
  const endingMinor = question?.id === "q1" && answers.q1 === "Under 18";
  const visibleOptions = question?.shuffle
    ? [...positionOrder, question.options[question.options.length - 1]]
    : question?.options || [];

  return (
    <div className="app survey">
      <div className="float-sticker sticker-a" aria-hidden="true">
        kesar
      </div>
      <div className="float-sticker sticker-b" aria-hidden="true">
        250 ml
      </div>
      <div className="float-sticker sticker-c" aria-hidden="true">
        chilled
      </div>

      <div className="shell">
        <aside className="meter-col">
          <p className="brand">
            Shree Aabhaan
            <span>saffron beverage survey</span>
          </p>
          <div
            className="meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={250}
            aria-valuenow={ml}
            aria-valuetext={`${ml} of 250 millilitres`}
          >
            <Bottle ml={ml} visualMl={ml === 0 ? 18 : ml} />
            <p className="meter-readout">
              <strong>{ml}</strong>
              <span> / 250 ml</span>
            </p>
          </div>
        </aside>

        <main className="card" id="question">
          {stage === "intro" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                goNext();
              }}
            >
              <p className="eyebrow">{COPY.brand}</p>
              <h1 ref={titleRef} tabIndex={-1}>
                {COPY.introTitle}
              </h1>
              <ul className="sticker-row">
                <li>250 ml</li>
                <li>glass bottle</li>
                <li>5 min</li>
              </ul>
              {COPY.intro.map((paragraph) => (
                <p className="lede" key={paragraph}>
                  {paragraph}
                </p>
              ))}
              <div className="actions">
                <span />
                <button className="btn btn-primary" type="submit">
                  Start the survey
                </button>
              </div>
            </form>
          )}

          {stage === "question" && question && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!submitting) goNext();
              }}
            >
              <p className="eyebrow">
                {question.section}
                <span>
                  Question {index + 1} of {path.length}
                </span>
              </p>
              <h1 id="q-title" ref={titleRef} tabIndex={-1} className="q-title">
                {question.title}
              </h1>
              {question.optional && <p className="optional-tag">Optional</p>}
              {question.hint && <p className="hint">{question.hint}</p>}
              {question.preamble && (
                <blockquote className={`preamble preamble-${question.preamble}`}>
                  {question.preamble === "price" && (
                    <p className="price-tag" aria-hidden="true">
                      <span>Test price</span>
                      <strong>₹60</strong>
                      <em>250 ml, taxes in, no delivery charge</em>
                    </p>
                  )}
                  <p>{preambleText(question.preamble)}</p>
                </blockquote>
              )}

              {question.type === "text" && (
                <label className="field">
                  <span className="sr-only">{question.title}</span>
                  {question.multiline ? (
                    <textarea
                      className="text-input"
                      rows={5}
                      value={answers[question.id]}
                      maxLength={question.maxLength || 1000}
                      onChange={(event) =>
                        update((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                    />
                  ) : (
                    <input
                      className="text-input"
                      value={answers[question.id]}
                      placeholder={question.placeholder || ""}
                      maxLength={question.maxLength || 160}
                      autoComplete="off"
                      onChange={(event) =>
                        update((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                    />
                  )}
                </label>
              )}

              {question.type === "single" && (
                <div className="options" role="radiogroup" aria-labelledby="q-title">
                  {visibleOptions.map((option) => {
                    const on = answers[question.id] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={on ? "option on" : "option"}
                        onClick={() => pickSingle(question, option)}
                      >
                        <span>{option}</span>
                        {question.details?.[option] && <small className="option-detail">{question.details[option]}</small>}
                      </button>
                    );
                  })}
                </div>
              )}

              {question.type === "multi" && (
                <div className="options" role="group" aria-labelledby="q-title">
                  <p className="cap">
                    {Array.isArray(selected) ? selected.length : 0} of {question.max} selected
                  </p>
                  {visibleOptions.map((option) => {
                    const on = Array.isArray(selected) && selected.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        className={on ? "option on" : "option"}
                        onClick={() => toggleMulti(question, option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {question.type === "scale" && (
                <div>
                  <div className="scale" role="radiogroup" aria-labelledby="q-title">
                    {[1, 2, 3, 4, 5].map((score) => {
                      const on = answers[question.id] === score;
                      const label =
                        score === 1
                          ? `1, ${question.minLabel}`
                          : score === 5
                            ? `5, ${question.maxLabel}`
                            : String(score);
                      return (
                        <button
                          key={score}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={label}
                          className={on ? "scale-btn on" : "scale-btn"}
                          onClick={() => update((current) => ({ ...current, [question.id]: score }))}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                  <div className="scale-labels">
                    <span>1 · {question.minLabel}</span>
                    {question.midLabel && <span>3 · {question.midLabel}</span>}
                    <span>5 · {question.maxLabel}</span>
                  </div>
                </div>
              )}

              {showOther && (
                <label className="field extra-field">
                  <span>{question.other.label}</span>
                  <input
                    className="text-input"
                    inputMode={question.other.numeric ? "numeric" : "text"}
                    value={answers[question.other.key]}
                    maxLength={question.other.numeric ? 2 : question.other.max || 160}
                    onChange={(event) =>
                      update((current) => ({ ...current, [question.other.key]: event.target.value }))
                    }
                  />
                </label>
              )}

              {question.contact && wantsContact(answers.q27) && (
                <div className="contact-box">
                  <p>{COPY.consent}</p>
                  <label className="field">
                    <span>Name</span>
                    <input
                      className="text-input"
                      autoComplete="name"
                      maxLength={80}
                      value={answers.name}
                      onChange={(event) => update((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Phone number or email address</span>
                    <input
                      className="text-input"
                      autoComplete="on"
                      maxLength={120}
                      value={answers.contact}
                      onChange={(event) => update((current) => ({ ...current, contact: event.target.value }))}
                    />
                  </label>
                </div>
              )}

              <label className="hp" htmlFor={honeypotId}>
                Leave this field empty
                <input
                  id={honeypotId}
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                />
              </label>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}

              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={goBack} disabled={submitting}>
                  Back
                </button>
                <div className="action-right">
                  {question.optional && (
                    <button className="btn btn-ghost" type="button" onClick={skip} disabled={submitting}>
                      Skip this question
                    </button>
                  )}
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? "Saving…" : endingMinor ? "End survey" : atEnd ? "Send my answers" : "Next"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {stage === "minor" && (
            <div>
              <p className="eyebrow">{COPY.brand}</p>
              <h1 ref={titleRef} tabIndex={-1}>
                Thank you
              </h1>
              <p className="lede">{COPY.minor}</p>
            </div>
          )}

          {stage === "thanks" && (
            <div>
              <p className="eyebrow">{COPY.brand}</p>
              <h1 ref={titleRef} tabIndex={-1}>
                {COPY.thanksTitle}
              </h1>
              {COPY.thanks.map((paragraph) => (
                <p className="lede" key={paragraph}>
                  {paragraph}
                </p>
              ))}
              <p className="lede">
                <strong>{COPY.thanksSignoff}</strong>
              </p>
              <div className="actions">
                <span />
                <button className="btn btn-primary" type="button" onClick={restart}>
                  Submit another response
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
