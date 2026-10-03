import { QUESTIONS, wantsContact } from "./survey.js";

export function intentScore(value) {
  const match = String(value || "").match(/^([1-5])/);
  return match ? Number(match[1]) : null;
}

export function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function mean(nums) {
  if (!nums.length) return null;
  return Math.round((nums.reduce((sum, n) => sum + n, 0) / nums.length) * 10) / 10;
}

function appealNumbers(records) {
  return records.map((record) => Number(record.q12)).filter((n) => n >= 1 && n <= 5);
}

function top2(records) {
  return records.filter((record) => {
    const score = intentScore(record.q19);
    return score === 4 || score === 5;
  }).length;
}

function snapshot(records) {
  const appeals = appealNumbers(records);
  const intent = top2(records);
  return {
    n: records.length,
    meanAppeal: mean(appeals),
    intentTop2: intent,
    intentTop2Pct: pct(intent, records.length),
  };
}

function tally(records, getValues, options, { optional = false, multi = false } = {}) {
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
  if (optional) {
    rows.push({ label: "Skipped", count: skipped, pct: pct(skipped, records.length) });
  }
  return { rows, multi, n: records.length };
}

function singleChart(records, id) {
  const question = QUESTIONS.find((item) => item.id === id);
  return tally(records, (record) => [record[id] ? String(record[id]) : ""], question.options, {
    optional: !question.required,
  });
}

function multiChart(records, id) {
  const question = QUESTIONS.find((item) => item.id === id);
  return {
    ...tally(
      records,
      (record) => (Array.isArray(record[id]) ? record[id] : []),
      question.options,
      { optional: !question.required, multi: true },
    ),
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
    if (raw.length > current.label.length) current.label = raw;
    groups.set(key, current);
  }
  const sorted = [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const top = sorted.slice(0, 12).map((row) => ({
    ...row,
    pct: pct(row.count, records.length),
  }));
  const rest = sorted.slice(12);
  if (rest.length) {
    const count = rest.reduce((sum, row) => sum + row.count, 0);
    top.push({
      label: `${rest.length} other place${rest.length === 1 ? "" : "s"}`,
      count,
      pct: pct(count, records.length),
    });
  }
  return top;
}

function appealChart(records) {
  const labels = [
    ["1", "1 — Not at all appealing"],
    ["2", "2"],
    ["3", "3"],
    ["4", "4"],
    ["5", "5 — Very appealing"],
  ];
  const counts = new Map(labels.map(([key]) => [key, 0]));
  for (const record of records) {
    const score = Number(record.q12);
    if (score >= 1 && score <= 5) counts.set(String(score), counts.get(String(score)) + 1);
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
    const appeal = Number(record.q12);
    const intent = intentScore(record.q19);
    if (appeal >= 1 && appeal <= 5 && intent >= 1 && intent <= 5) {
      matrix[5 - appeal][intent - 1] += 1;
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
  const completed = records.filter((record) => record.status === "completed");
  const screened = records.filter((record) => record.status === "screened_out");
  const buyers = completed.filter((record) => record.q4 === "Yes");
  const nonBuyers = completed.filter((record) => record.q4 === "No");

  let slice = completed;
  if (segment === "buyers") slice = buyers;
  if (segment === "nonbuyers") slice = nonBuyers;
  if (strongOnly) {
    slice = slice.filter((record) => {
      const score = intentScore(record.q19);
      return score === 4 || score === 5;
    });
  }
  const query = cityQuery.trim().toLowerCase();
  if (query) slice = slice.filter((record) => String(record.q2 || "").toLowerCase().includes(query));

  const habitBase = slice.filter((record) => record.q4 === "Yes");
  const blocks = [];

  blocks.push({
    id: "interest",
    kicker: "Whether the concept attracts interest",
    title: "Appeal next to willingness to buy at ₹60",
    purpose:
      "High appeal with low willingness to buy means the idea is interesting, but ₹60 is not yet a yes. Read the grid across, not as two separate scores.",
    charts: [
      chart(
        "How appealing is the drink idea?",
        "1 means not at all appealing. 5 means very appealing.",
        appealChart(slice),
      ),
      chart(
        "Likelihood of buying at least one bottle within 30 days at ₹60",
        "4 and 5 are the people to watch.",
        singleChart(slice, "q19"),
      ),
    ],
    heatmap: true,
  });

  blocks.push({
    id: "who",
    kicker: "Which customers and locations to focus on",
    title: "Who answered, and where they live",
    purpose: "Compare age, city, income and buying habits with willingness to buy at ₹60. Use the strong-intent filter to see the likely buyers.",
    charts: [
      chart("Age group", "", singleChart(slice, "q1")),
      chart("City and area", "Grouped by the text people typed. Spelling variants stay separate.", {
        n: slice.length,
        rows: cityRows(slice),
        multi: false,
      }),
      chart("Monthly household income", "Optional question.", singleChart(slice, "q3")),
      chart("Buys packaged cold beverages", "", singleChart(slice, "q4")),
    ],
  });

  if (segment !== "nonbuyers" && habitBase.length > 0) {
    blocks.push({
      id: "habits",
      kicker: "Current drink habits",
      title: "What buyers do today",
      purpose: "Asked only of people who buy packaged cold drinks. Non-buyers skipped this section.",
      charts: [
        chart("How often they buy", "", singleChart(habitBase, "q5")),
        chart("Drinks they buy most often", "Up to 3 answers, so the shares can add up past 100%.", multiChart(habitBase, "q6"), {
          footnotes: footnotes(habitBase, "q6Other"),
        }),
        chart("Where they buy", "This is the placement clue, especially with strong purchase intent turned on.", multiChart(habitBase, "q7"), {
          footnotes: footnotes(habitBase, "q7Other"),
        }),
      ],
    });
  }

  const devCharts = [
    chart("Sweetness preference", "Brief this for the recipe.", segment === "nonbuyers" ? { n: 0, rows: [], multi: false } : singleChart(habitBase, "q10")),
    chart("Version they want to try", "", singleChart(slice, "q14"), { footnotes: footnotes(slice, "q14Other") }),
    chart("Bottle size for one occasion", "", singleChart(slice, "q15")),
    chart("What might stop a purchase", "Up to 3 answers. “No particular concern” was only allowed on its own.", multiChart(slice, "q16"), {
      footnotes: footnotes(slice, "q16Other"),
    }),
    chart("When they would buy it", "Up to 2 answers.", multiChart(slice, "q13")),
    chart("What saffron means to them", "Optional. Up to 3 answers.", multiChart(slice, "q23"), {
      footnotes: footnotes(slice, "q23Other"),
    }),
  ];
  if (segment !== "nonbuyers") {
    devCharts.unshift(
      chart("What matters most when they choose a drink", "Up to 3 answers. Asked only of current buyers.", multiChart(habitBase, "q8"), {
        footnotes: footnotes(habitBase, "q8Other"),
      }),
    );
  }

  blocks.push({
    id: "develop",
    kicker: "What to ask FFCE to develop",
    title: "Flavour, sweetness, size and worries",
    purpose: "Use priorities, sweetness, preferred version, bottle size and concerns as the development brief.",
    charts: devCharts.filter((item) => item.n > 0 || segment === "nonbuyers"),
  });

  // The sweetness chart is empty for a non-buyer slice because it lives in the habit section.
  // Drop empty charts that have no rows so the page doesn't show a blank card.
  const develop = blocks.find((block) => block.id === "develop");
  develop.charts = develop.charts.filter((item) => item.n > 0 && item.rows?.length);

  blocks.push({
    id: "price",
    kicker: "What price to test further",
    title: "What they pay now, what they say they would pay, and the ₹60 test",
    purpose:
      "Read current spending, the maximum they would pay, and the answer to ₹60 together. ₹60 is a test price, not a recommendation.",
    charts: [
      ...(segment === "nonbuyers"
        ? []
        : [chart("Usual spend on a 250–300 ml packaged drink", "Asked only of current buyers.", singleChart(habitBase, "q9"))]),
      chart("Price below which quality starts to look doubtful", "Optional.", singleChart(slice, "q17")),
      chart("Maximum they would pay for one 250 ml bottle", "", singleChart(slice, "q18")),
    ],
  });

  blocks.push({
    id: "place",
    kicker: "Where to place initial stock",
    title: "Current buying channel",
    purpose: "Turn on strong purchase intent to see where people who would actually buy at ₹60 shop today.",
    charts:
      segment === "nonbuyers" || habitBase.length === 0
        ? []
        : [
            chart(
              "Where current buyers purchase packaged drinks",
              "Best read among respondents with strong purchase intent.",
              multiChart(habitBase, "q7"),
              { footnotes: footnotes(habitBase, "q7Other") },
            ),
          ],
  });

  blocks.push({
    id: "volume",
    kicker: "How many bottles to consider initially",
    title: "First purchase and first 30 days, kept apart",
    purpose: "Q21 already includes the first purchase. Do not add Q20 and Q21 together.",
    warning:
      "Treat these answers as planning inputs, not confirmed orders. Validate quantity with a paid trial before committing to a commercial batch.",
    charts: [
      chart("Bottles in the first purchase at ₹60", "Does not include free samples.", singleChart(slice, "q20"), {
        footnotes: footnotes(slice, "q20Other").map((value) => `Other amount: ${value}`),
      }),
      chart(
        "Bottles expected during the first 30 days at ₹60",
        "This total already includes the first purchase. People were told not to assume they will like the taste.",
        singleChart(slice, "q21"),
      ),
      chart("Preferred buying option at the same price per bottle", "No multipack discount was offered.", singleChart(slice, "q22")),
    ],
  });

  const contacts = slice
    .filter((record) => wantsContact(record.q24))
    .map((record) => ({
      id: record.id,
      name: record.name || "",
      contact: record.contact || "",
      permission: record.q24,
      city: record.q2 || "",
      appeal: record.q12 || "",
      intent: record.q19 || "",
      intentScore: intentScore(record.q19),
      submittedAt: record.submittedAt || "",
    }))
    .sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0) || String(a.city).localeCompare(String(b.city)));

  const reachable = completed.filter((record) => wantsContact(record.q24) && String(record.contact || "").trim()).length;

  return {
    global: {
      responses: records.length,
      completed: completed.length,
      screened: screened.length,
      buyers: buyers.length,
      nonBuyers: nonBuyers.length,
      ...snapshot(completed),
      contactYes: completed.filter((record) => wantsContact(record.q24)).length,
      reachable,
    },
    split: {
      buyers: snapshot(buyers),
      nonBuyers: snapshot(nonBuyers),
    },
    slice: {
      segment,
      strongOnly,
      cityQuery,
      ...snapshot(slice),
    },
    blocks,
    heatmap: heatmap(slice),
    contacts,
  };
}
