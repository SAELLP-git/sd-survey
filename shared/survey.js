/** Respondent-facing wording is the research instrument. Keep it stable. */

export const SURVEY_VERSION = "v3-short";

export const COPY = {
  introTitle: "Help shape a new saffron drink",
  intro: [
    "We’re making a chilled saffron (kesar) drink. Tell us what you think.",
    "No right or wrong answers. “Not interested” helps too.",
    "Contact details are optional.",
  ],
  thanksTitle: "Thank you!",
  thanks: ["Your answers will shape the taste, sweetness, pack and price."],
  thanksSignoff: "Thanks for being part of it.",
  brand: "Shree Aabhaan Epicurean",
  concept:
    "Picture a chilled, water-based saffron (kesar) drink in a 250 ml bottle. The recipe is still being developed.",
  consent: "We’ll contact you only for what you chose. This is not an order.",
  minor: "Thanks! This survey is for ages 18 and over.",
};

export const HABIT_IDS = ["q5", "q6", "q7", "q8"];
export const FOLLOWUP_IDS = ["q21", "q22"];

const OTHER = (key) => ({ option: "Other", key, label: "Please specify", max: 160 });

export const QUESTIONS = [
  {
    id: "q1",
    section: "About you",
    title: "Your age?",
    type: "single",
    required: true,
    options: ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+"],
  },
  {
    id: "q2",
    section: "About you",
    title: "Your city and area?",
    type: "text",
    required: true,
    placeholder: "Andheri, Mumbai",
    requiredMessage: "Enter your city and area.",
    maxLength: 120,
  },
  {
    id: "q3",
    section: "About you",
    title: "Monthly household income?",
    type: "single",
    required: false,
    optional: true,
    options: ["Under ₹30k", "₹30k–₹60k", "₹60k–₹1L", "₹1L–₹2L", "Above ₹2L", "Prefer not to say"],
  },
  {
    id: "q4",
    section: "About you",
    title: "Do you buy packaged cold drinks?",
    type: "single",
    required: true,
    hint: "Juice, soda, iced tea, lassi and similar. Not plain water.",
    options: ["Yes", "No"],
  },
  {
    id: "q5",
    section: "Your drinks",
    title: "How often do you buy them?",
    type: "single",
    required: true,
    options: ["Daily", "A few times a week", "Weekly", "Monthly", "Rarely"],
  },
  {
    id: "q6",
    section: "Your drinks",
    title: "What do you buy most?",
    type: "multi",
    required: true,
    max: 3,
    options: [
      "Soda / soft drinks",
      "Juice",
      "Iced tea / cold coffee",
      "Energy / sports drinks",
      "Lassi / flavoured milk",
      "Coconut water",
      "Sharbat / traditional",
      "Other",
    ],
    other: OTHER("q6Other"),
  },
  {
    id: "q7",
    section: "Your drinks",
    title: "Where do you buy them?",
    type: "multi",
    required: true,
    max: 3,
    options: [
      "Kirana store",
      "Supermarket",
      "Quick-commerce app",
      "Café / restaurant",
      "Office / college canteen",
      "Online",
      "Other",
    ],
    other: OTHER("q7Other"),
  },
  {
    id: "q8",
    section: "Your drinks",
    title: "What matters most?",
    type: "multi",
    required: true,
    max: 3,
    options: ["Taste", "Price", "Low sugar", "Natural ingredients", "Refreshment", "Brand", "Packaging", "Other"],
    other: OTHER("q8Other"),
  },
  {
    id: "q9",
    section: "Saffron",
    title: "Have you had saffron (kesar) before?",
    type: "single",
    required: true,
    options: ["Often", "Sometimes", "Once or twice", "Never"],
  },
  {
    id: "q10",
    section: "Saffron",
    title: "What does saffron mean to you?",
    type: "multi",
    required: true,
    max: 3,
    exclusive: ["Nothing in particular"],
    options: [
      "Premium",
      "Indian tradition",
      "Festivals",
      "Health",
      "Distinct flavour",
      "Expensive",
      "Nothing in particular",
      "Other",
    ],
    other: OTHER("q10Other"),
  },
  {
    id: "q11",
    section: "The drink",
    title: "How appealing is this drink?",
    type: "scale",
    required: true,
    preamble: "concept",
    min: 1,
    max: 5,
    minLabel: "Not appealing",
    midLabel: "Somewhat",
    maxLabel: "Very appealing",
  },
  {
    id: "q12",
    section: "The drink",
    title: "What would you expect from it?",
    type: "multi",
    required: true,
    max: 3,
    exclusive: ["Nothing in particular"],
    options: [
      "Refreshment",
      "Energy",
      "Good mood",
      "Wellness",
      "Premium feel",
      "Traditional taste",
      "Better than soda",
      "Something new",
      "Nothing in particular",
      "Other",
    ],
    other: OTHER("q12Other"),
  },
  {
    id: "q13",
    section: "Taste",
    title: "Preferred taste?",
    type: "single",
    required: true,
    options: ["Light and refreshing", "Sweet and traditional", "Floral", "Citrusy", "Rich", "Not sure"],
  },
  {
    id: "q14",
    section: "Taste",
    title: "Which flavour would you try?",
    type: "single",
    required: true,
    options: [
      "Saffron only",
      "Saffron + rose",
      "Saffron + cardamom",
      "Saffron + lemon",
      "Saffron + mint",
      "None of these",
    ],
  },
  {
    id: "q15",
    section: "Taste",
    title: "How sweet?",
    type: "single",
    required: true,
    options: ["Unsweetened", "Lightly sweet", "Medium", "Very sweet", "Not sure"],
  },
  {
    id: "q16",
    section: "Taste",
    title: "Still or fizzy?",
    type: "single",
    required: true,
    options: ["Still", "Lightly sparkling", "Fizzy", "No preference"],
  },
  {
    id: "q17",
    section: "Taste",
    title: "Which pack do you prefer?",
    type: "single",
    required: true,
    hint: "Assume the same price for each.",
    options: ["Glass bottle", "Can", "Plastic bottle", "No preference"],
  },
  {
    id: "q18",
    section: "Price",
    title: "What’s a fair price for 250 ml?",
    type: "single",
    required: true,
    options: ["Under ₹40", "₹40–₹59", "₹60–₹79", "₹80–₹99", "₹100–₹149", "₹150+", "Can’t say"],
  },
  {
    id: "q19",
    section: "Price",
    title: "How does ₹60 for 250 ml feel?",
    type: "single",
    required: true,
    options: ["Cheap", "Fair", "Expensive", "Too expensive", "Can’t say"],
  },
  {
    id: "q20",
    section: "Price",
    title: "At ₹60, would you buy one in the first month?",
    type: "single",
    required: true,
    options: [
      "1 — Definitely not",
      "2 — Probably not",
      "3 — Not sure",
      "4 — Probably yes",
      "5 — Definitely yes",
    ],
  },
  {
    id: "q21",
    section: "Price",
    title: "At ₹120, how many bottles in the first month?",
    type: "single",
    required: true,
    hint: "Include your first purchase.",
    options: ["0", "1–2", "3–5", "6–10", "More than 10", "Can’t say"],
  },
  {
    id: "q22",
    section: "Price",
    title: "If you like it, how often would you buy?",
    type: "single",
    required: true,
    options: ["Daily", "A few times a week", "Weekly", "Monthly", "Occasionally", "Not again"],
  },
  {
    id: "q23",
    section: "Your view",
    title: "Which idea appeals most?",
    type: "single",
    required: true,
    shuffle: true,
    options: [
      "A — Premium",
      "B — Wellness",
      "C — Uplifting",
      "D — Energy",
      "E — Heritage",
      "F — Refreshing",
      "G — None of these",
    ],
    details: {
      "A — Premium": "A premium treat for every day.",
      "B — Wellness": "Inspired by traditional wellness.",
      "C — Uplifting": "Makes everyday moments brighter.",
      "D — Energy": "For active, on-the-go days.",
      "E — Heritage": "A classic Indian ingredient, made modern.",
      "F — Refreshing": "Distinctive and refreshing.",
    },
  },
  {
    id: "q24",
    section: "Your view",
    title: "What would make you switch to it?",
    type: "multi",
    required: true,
    max: 2,
    exclusive: ["Wouldn’t switch", "I don’t buy packaged drinks"],
    options: [
      "Better taste",
      "Less sugar",
      "Real saffron",
      "Natural ingredients",
      "Something new",
      "Better value",
      "Wouldn’t switch",
      "I don’t buy packaged drinks",
      "Other",
    ],
    other: OTHER("q24Other"),
  },
  {
    id: "q25",
    section: "Your view",
    title: "What might stop you buying it?",
    type: "multi",
    required: true,
    max: 3,
    exclusive: ["Nothing"],
    options: [
      "Price",
      "Unsure about taste",
      "Doubt it’s real saffron",
      "Too sugary",
      "Additives",
      "Hard to find",
      "Prefer my usual drink",
      "Want to taste first",
      "Nothing",
      "Other",
    ],
    other: OTHER("q25Other"),
  },
  {
    id: "q26",
    section: "Last bit",
    title: "One thing that would make you buy it?",
    type: "text",
    required: false,
    optional: true,
    multiline: true,
    maxLength: 1000,
  },
  {
    id: "q27",
    section: "Last bit",
    title: "Can we contact you?",
    type: "single",
    required: true,
    contact: true,
    options: ["Yes — tastings", "Yes — launch updates", "Yes — both", "No"],
  },
];

const byId = Object.fromEntries(QUESTIONS.map((question) => [question.id, question]));

export function questionById(id) {
  return byId[id];
}

export function isHabit(id) {
  return HABIT_IDS.includes(id);
}

export function intentScore(value) {
  const match = String(value || "").match(/^([1-5])/);
  return match ? Number(match[1]) : null;
}

export function showsPurchaseFollowup(value) {
  const score = intentScore(value);
  if (score == null) return true;
  return score >= 3;
}

export function buildPath(answers) {
  if (answers?.q1 === "Under 18") return ["q1"];
  return QUESTIONS.map((question) => question.id).filter((id) => {
    if (isHabit(id) && answers?.q4 === "No") return false;
    if (FOLLOWUP_IDS.includes(id) && !showsPurchaseFollowup(answers?.q20)) return false;
    return true;
  });
}

export function wantsContact(value) {
  return typeof value === "string" && value.startsWith("Yes");
}

export function preambleText(key) {
  if (!key) return "";
  return COPY[key] || "";
}

export function positioningCode(value) {
  const match = String(value || "").match(/^([A-G]) —/);
  return match ? match[1] : "";
}

export function pruneAnswers(answers) {
  const next = { ...answers };
  if (next.q4 === "No") {
    next.q5 = "";
    next.q6 = [];
    next.q6Other = "";
    next.q7 = [];
    next.q7Other = "";
    next.q8 = [];
    next.q8Other = "";
  }
  if (next.q20 && !showsPurchaseFollowup(next.q20)) {
    next.q21 = "";
    next.q22 = "";
  }
  if (!wantsContact(next.q27)) {
    next.name = "";
    next.contact = "";
  }
  return next;
}
