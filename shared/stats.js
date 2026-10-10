import { QUESTIONS, SURVEY_VERSION, intentScore, wantsContact } from "./survey.js";

export { intentScore };

export function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function mean(nums) {
  if (!nums.length) return null;
  return Math.round((nums.reduce((sum, n) => sum + n, 0) / nums.length) * 10) / 10;
}

function top2(records, read) {
  return records.filter((record) => read(record) >= 4).length;
}

function appeal(record) {
  const score = Number(record.q11);
  return score >= 1 && score <= 5 ? score : null;
}

function snapshot(records) {
  const appeals = records.map(appeal).filter((score) => score != null);
  const appealTop = top2(records, (record) => appeal(record) || 0);
  const intentTop = top2(records, (record) => intentScore(record.q20) || 0);
  const accepted = records.filter((record) =>
    ["Cheap", "Fair"].includes(record.q19),
  ).length;
  return {
    n: records.length,
    meanAppeal: mean(appeals),
    appealTop2: appealTop,
    appealTop2Pct: pct(appealTop, records.length),
    intentTop2: intentTop,
    intentTop2Pct: pct(intentTop, records.length),
    priceAccept: accepted,
    priceAcceptPct: pct(accepted, records.length),
  };
}

function tally(records, getValues, options, { optional = false } = {}) {
  const counts = new Map(options.map((option) => [option, 0]));
  let skipped = 0;
  for (const record of records) {
    const values = getValues(record).filter(Boolean);
    if (!values.length) {
      skipped += 1;
      continue;
    }
    for (const value of values) {
      if (counts.has(value)) counts.set(value, counts.get(value) + 1);
    }
  }
  const rows = [...counts.entries()].map(([label, count]) => ({
    label,
    count,
    pct: pct(count, records.length),
  }));
  if (optional) rows.push({ label: "Skipped", count: skipped, pct: pct(skipped, records.length) });
  return { rows, n: records.length, multi: false };
}

function question(id) {
  return QUESTIONS.find((item) => item.id === id);
}

function singleChart(records, id) {
  const item = question(id);
  return tally(records, (record) => [record[id] ? String(record[id]) : ""], item.options, {
    optional: !item.required,
  });
}

function multiChart(records, id) {
  const item = question(id);
  return {
    ...tally(records, (record) => (Array.isArray(record[id]) ? record[id] : []), item.options, {
      optional: !item.required,
    }),
    multi: true,
  };
}

function footnotes(records, key) {
  const seen = [];
  for (const record of records) {
    const value = String(record[key] || "").trim();
    if (value && !seen.includes(value)) seen.push(value);
  }
  return seen.slice(0, 30);
}

function cityRows(records) {
  const groups = new Map();
  for (const record of records) {
    const raw = String(record.q2 || "").trim().replace(/\s+/g, " ");
    if (!raw) continue;
    const key = raw.toLowerCase();
    const current = groups.get(key) || { label: raw, count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 12)
    .map((row) => ({ ...row, pct: pct(row.count, records.length) }));
}

function appealChart(records) {
  const labels = [
    ["1", "1 — Not appealing"],
    ["2", "2"],
    ["3", "3 — Somewhat"],
    ["4", "4"],
    ["5", "5 — Very appealing"],
  ];
  const counts = new Map(labels.map(([key]) => [key, 0]));
  for (const record of records) {
    const score = appeal(record);
    if (score) counts.set(String(score), counts.get(String(score)) + 1);
  }
  return {
    n: records.length,
    multi: false,
    rows: labels.map(([key, label]) => ({
      label,
      count: counts.get(key),
      pct: pct(counts.get(key), records.length),
    })),
  };
}

function heatmap(records) {
  const matrix = Array.from({ length: 5 }, () => Array(5).fill(0));
  let n = 0;
  for (const record of records) {
    const appealScore = appeal(record);
    const intent = intentScore(record.q20);
    if (appealScore && intent) {
      matrix[5 - appealScore][intent - 1] += 1;
      n += 1;
    }
  }
  return { n, matrix };
}

function chart(title, hint, data, extra = {}) {
  return { title, hint, ...data, ...extra };
}

export function summarize(allRecords, { segment = "all", strongOnly = false, cityQuery = "" } = {}) {
  const records = Array.isArray(allRecords) ? allRecords : [];
  const current = records.filter((record) => record.surveyVersion === SURVEY_VERSION);
  const legacy = records.length - current.length;
  const completed = current.filter((record) => record.status === "completed");
  const screened = current.filter((record) => record.status === "screened_out");
  const buyers = completed.filter((record) => record.q4 === "Yes");
  const nonBuyers = completed.filter((record) => record.q4 === "No");

  let slice = completed;
  if (segment === "buyers") slice = buyers;
  if (segment === "nonbuyers") slice = nonBuyers;
  if (strongOnly) slice = slice.filter((record) => (intentScore(record.q20) || 0) >= 4);
  const query = cityQuery.trim().toLowerCase();
  if (query) slice = slice.filter((record) => String(record.q2 || "").toLowerCase().includes(query));

  const habitBase = slice.filter((record) => record.q4 === "Yes");
  const followupBase = slice.filter((record) => (intentScore(record.q20) || 0) >= 3);
  const blocks = [
    {
      id: "interest",
      kicker: "Concept appeal against ₹60 purchase intent",
      title: "Interest and willingness to buy",
      purpose:
        "Compare people who find the idea appealing with people who would buy at ₹60. A high appeal score can still come with a low willingness to buy.",
      charts: [
        chart("How appealing is the concept?", "Share selecting 4 or 5 is the appeal measure.", appealChart(slice)),
        chart("Likelihood of buying at least one bottle within 30 days at ₹60", "Share selecting 4 or 5 is the purchase-intent measure.", singleChart(slice, "q20")),
      ],
      heatmap: true,
    },
    {
      id: "who",
      kicker: "Who answered",
      title: "Age, place, income and saffron familiarity",
      purpose: "Break results down by age, income, city and familiarity. Use the filters to compare buyers and non-buyers.",
      charts: [
        chart("Age group", "", singleChart(slice, "q1")),
        chart("City and area", "Grouped by the text people typed.", { n: slice.length, rows: cityRows(slice), multi: false }),
        chart("Monthly household income", "Optional question.", singleChart(slice, "q3")),
        chart("Buys packaged cold beverages", "", singleChart(slice, "q4")),
        chart("Familiarity with saffron", "", singleChart(slice, "q9")),
      ],
    },
  ];

  if (segment !== "nonbuyers" && habitBase.length) {
    blocks.push({
      id: "habits",
      kicker: "Existing beverage habits",
      title: "What current buyers do",
      purpose: "Asked only of people who purchase packaged cold drinks.",
      charts: [
        chart("How often they buy", "", singleChart(habitBase, "q5")),
        chart("Drinks they buy most often", "Up to 3 answers.", multiChart(habitBase, "q6"), { footnotes: footnotes(habitBase, "q6Other") }),
        chart("Where they most often buy", "Up to 3 answers.", multiChart(habitBase, "q7"), { footnotes: footnotes(habitBase, "q7Other") }),
        chart("What matters most", "Up to 3 answers.", multiChart(habitBase, "q8"), { footnotes: footnotes(habitBase, "q8Other") }),
      ],
    });
  }

  blocks.push(
    {
      id: "taste",
      kicker: "Taste and product",
      title: "Flavour, sweetness, feel and pack",
      purpose: "Use these answers to brief formulation and packaging. The price test stays on the 250 ml format.",
      charts: [
        chart("Preferred taste experience", "", singleChart(slice, "q13")),
        chart("Flavour combination to try", "", singleChart(slice, "q14")),
        chart("Sweetness", "", singleChart(slice, "q15")),
        chart("How the drink should feel", "", singleChart(slice, "q16")),
        chart("Packaging format", "People were told to assume the same price.", singleChart(slice, "q17")),
        chart("What they associate with saffron", "Up to 3 answers.", multiChart(slice, "q10"), { footnotes: footnotes(slice, "q10Other") }),
        chart("What they would expect from this drink", "Expectations, not verified claims. Up to 3 answers.", multiChart(slice, "q12"), {
          footnotes: footnotes(slice, "q12Other"),
        }),
      ],
    },
    {
      id: "price",
      kicker: "Price",
      title: "A reasonable price, then the ₹60 test",
      purpose: "The reasonable-price question is asked before ₹60 is revealed. Price acceptance is the share who then call ₹60 cheap or fair.",
      charts: [
        chart("Price considered reasonable for 250 ml", "", singleChart(slice, "q18")),
        chart("Perception of ₹60, including taxes", "", singleChart(slice, "q19")),
      ],
    },
    {
      id: "volume",
      kicker: "Directional demand",
      title: "30-day quantity and repeat interest",
      purpose: "Shown only to people who were unsure or said they would buy at ₹60.",
      warning:
        "Treat quantity and repeat frequency as directional indicators. Do not multiply them into a sales forecast.",
      charts: [
        chart("Bottles expected in the first 30 days at ₹120", "Includes the first purchase. Asked only when purchase intent was 3, 4 or 5.", singleChart(followupBase, "q21")),
        chart("How often they might buy if they enjoy it", "This assumes they like the taste and the price. It is not a sales forecast.", singleChart(followupBase, "q22")),
      ].filter((item) => item.n > 0),
    },
    {
      id: "position",
      kicker: "Positioning, switching and barriers",
      title: "What would pull them in, and what would stop them",
      purpose: "Positioning codes A–F were shown in a random order. G stayed last.",
      charts: [
        chart("Preferred description", "", singleChart(slice, "q23")),
        chart("What would encourage a switch", "Up to 2 answers. The two “would not switch” options were exclusive.", multiChart(slice, "q24"), {
          footnotes: footnotes(slice, "q24Other"),
        }),
        chart("What could prevent a purchase", "Up to 3 answers.", multiChart(slice, "q25"), { footnotes: footnotes(slice, "q25Other") }),
      ],
    },
  );

  const comments = footnotes(slice, "q26");
  if (comments.length) {
    blocks.push({
      id: "comments",
      kicker: "Open feedback",
      title: "The one change that would make it worth buying",
      purpose: "Optional. Each note is one person’s answer.",
      charts: [
        chart("Written answers", "", {
          n: comments.length,
          rows: comments.map((label) => ({ label, count: 1, pct: pct(1, slice.length) })),
          multi: false,
        }),
      ],
    });
  }

  const contacts = slice
    .filter((record) => wantsContact(record.q27))
    .map((record) => ({
      id: record.id,
      name: record.name || "",
      contact: record.contact || "",
      permission: record.q27,
      city: record.q2 || "",
      appeal: record.q11 || "",
      intent: record.q20 || "",
      intentScore: intentScore(record.q20),
    }))
    .sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));

  return {
    legacy,
    global: {
      responses: current.length,
      completed: completed.length,
      screened: screened.length,
      buyers: buyers.length,
      nonBuyers: nonBuyers.length,
      ...snapshot(completed),
      contactYes: completed.filter((record) => wantsContact(record.q27)).length,
      reachable: completed.filter((record) => wantsContact(record.q27) && String(record.contact || "").trim()).length,
    },
    split: { buyers: snapshot(buyers), nonBuyers: snapshot(nonBuyers) },
    slice: { segment, strongOnly, cityQuery, ...snapshot(slice) },
    blocks,
    heatmap: heatmap(slice),
    contacts,
  };
}
