import { QUESTIONS, SURVEY_VERSION, buysPackagedDrinks, wantsContact } from "./survey.js";

const FAIR_AT_LEAST_60 = ["₹60–₹79", "₹80–₹99", "₹100–₹149", "₹150+"];

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
  const fair = records.filter((record) => FAIR_AT_LEAST_60.includes(record.q18)).length;
  return {
    n: records.length,
    meanAppeal: mean(appeals),
    appealTop2: appealTop,
    appealTop2Pct: pct(appealTop, records.length),
    fairAtLeast60: fair,
    fairAtLeast60Pct: pct(fair, records.length),
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

function chart(title, hint, data, extra = {}) {
  return { title, hint, ...data, ...extra };
}

export function summarize(allRecords, { segment = "all", cityQuery = "" } = {}) {
  const records = Array.isArray(allRecords) ? allRecords : [];
  const current = records.filter((record) => record.surveyVersion === SURVEY_VERSION);
  const legacy = records.length - current.length;
  const completed = current.filter((record) => record.status === "completed");
  const screened = current.filter((record) => record.status === "screened_out");
  const buyers = completed.filter((record) => buysPackagedDrinks(record.q4));
  const nonBuyers = completed.filter((record) => record.q4 && !buysPackagedDrinks(record.q4));

  let slice = completed;
  if (segment === "buyers") slice = buyers;
  if (segment === "nonbuyers") slice = nonBuyers;
  const query = cityQuery.trim().toLowerCase();
  if (query) slice = slice.filter((record) => String(record.q2 || "").toLowerCase().includes(query));

  const habitBase = slice.filter((record) => buysPackagedDrinks(record.q4));
  const blocks = [
    {
      id: "interest",
      kicker: "Concept appeal",
      title: "How appealing is the idea?",
      purpose: "The appeal measure is the share who score the idea 4 or 5.",
      charts: [chart("How appealing is the concept?", "Share selecting 4 or 5 is the appeal measure.", appealChart(slice))],
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
        chart("How often they buy packaged cold drinks", "“I don't buy them” is the non-buyer group.", singleChart(slice, "q4")),
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
        chart("Drinks they buy most often", "Up to 3 answers.", multiChart(habitBase, "q6"), { footnotes: footnotes(habitBase, "q6Other") }),
        chart("Where they most often buy", "Up to 3 answers.", multiChart(habitBase, "q7"), { footnotes: footnotes(habitBase, "q7Other") }),
        chart("What matters most", "Up to 3 answers.", multiChart(habitBase, "q8"), { footnotes: footnotes(habitBase, "q8Other") }),
      ],
    });
  }

  blocks.push(
    {
      id: "taste",
      kicker: "Taste and meaning",
      title: "Taste, sweetness and what saffron means",
      purpose: "Use these answers to brief the recipe. The drink described was a chilled, low-carbonated Kashmiri saffron drink in a 250 ml glass bottle.",
      charts: [
        chart("Preferred taste experience", "", singleChart(slice, "q13")),
        chart("Sweetness", "", singleChart(slice, "q15")),
        chart("What saffron means to them", "Up to 3 answers.", multiChart(slice, "q10"), { footnotes: footnotes(slice, "q10Other") }),
        chart("What they would expect from this drink", "Expectations, not verified claims. Up to 3 answers.", multiChart(slice, "q12"), {
          footnotes: footnotes(slice, "q12Other"),
        }),
      ],
    },
    {
      id: "price",
      kicker: "Price and repeat",
      title: "A fair price, and how often they might buy",
      purpose: "Fair price is for a premium 250 ml saffron drink. Repeat frequency assumes they like it. Do not turn it into a sales forecast.",
      charts: [
        chart("Fair price for a premium 250 ml saffron drink", "", singleChart(slice, "q18")),
        chart("How often they might buy if they like it", "This assumes they enjoy the taste. It is not a sales forecast.", singleChart(slice, "q22")),
      ],
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

  const contacts = slice
    .filter((record) => wantsContact(record.q27))
    .map((record) => ({
      id: record.id,
      name: record.name || "",
      contact: record.contact || "",
      permission: record.q27,
      city: record.q2 || "",
      appeal: record.q11 || "",
    }))
    .sort((a, b) => (Number(b.appeal) || 0) - (Number(a.appeal) || 0));

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
    slice: { segment, cityQuery, ...snapshot(slice) },
    blocks,
    contacts,
  };
}
