import ExcelJS from "exceljs";
import { summarize } from "../shared/stats.js";

const COLUMNS = [
  ["id", "Response ID", 16],
  ["submittedAt", "Submitted at", 22],
  ["statusLabel", "Status", 24],
  ["buyer", "Buys packaged cold drinks", 18],
  ["q1", "Q1 Age group", 16],
  ["qNameEmail", "Name or email ID (optional)", 28],
  ["q2", "Q2 City and area", 28],
  ["q3", "Q3 Household income (optional)", 28],
  ["q4", "Q4 Buys packaged cold beverages", 22],
  ["q5", "Q5 Buying frequency", 24],
  ["q6", "Q6 Drinks bought most often", 42],
  ["q6Other", "Q6 Other drink", 24],
  ["q7", "Q7 Where they buy", 32],
  ["q7Other", "Q7 Other place", 24],
  ["q8", "Q8 What matters most", 36],
  ["q8Other", "Q8 Other priority", 24],
  ["q9", "Q9 Usual spend for 250–300 ml", 28],
  ["q10", "Q10 Sweetness preference", 22],
  ["q11", "Q11 Tried saffron before", 24],
  ["q12", "Q12 Appeal (1–5)", 16],
  ["q13", "Q13 When they would buy", 36],
  ["q14", "Q14 Preferred version", 36],
  ["q14Other", "Q14 Other version", 24],
  ["q15", "Q15 Bottle size", 20],
  ["q16", "Q16 Barriers", 42],
  ["q16Other", "Q16 Other barrier", 24],
  ["q17", "Q17 Price that raises quality doubts (optional)", 36],
  ["q18", "Q18 Maximum willing to pay", 32],
  ["q19", "Q19 Likelihood to buy at ₹60", 32],
  ["q20", "Q20 First-purchase bottles", 28],
  ["q20Other", "Q20 Other bottle count", 18],
  ["q21", "Q21 Bottles in first 30 days", 32],
  ["q22", "Q22 Preferred buying option", 24],
  ["q23", "Q23 Saffron associations (optional)", 36],
  ["q23Other", "Q23 Other association", 24],
  ["q24", "Q24 Contact permission", 40],
  ["name", "Name", 22],
  ["contact", "Phone or email", 28],
];

function excelSafe(value) {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return excelSafe(value.join("; "));
  if (value == null) return "";
  const text = String(value);
  if (/^[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

function statusLabel(record) {
  if (record.status === "screened_out") return "Screened out — under 18";
  if (record.status === "completed") return "Completed";
  return record.status || "";
}

function buildWorkbook(records) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sip check survey";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("How to read");
  const stats = summarize(records);
  const lines = [
    ["Sip check — beverage preferences and new drink feedback"],
    ["₹60 is a test price for a 250 ml water-based saffron drink, not a pricing recommendation."],
    [""],
    ["Completed responses", stats.global.completed],
    ["Screened out (under 18)", stats.global.screened],
    ["Buy packaged cold drinks", stats.global.buyers],
    ["Do not buy packaged cold drinks", stats.global.nonBuyers],
    ["Mean appeal (1–5), completed responses", stats.global.meanAppeal ?? ""],
    ["Probably or definitely would buy at ₹60", stats.global.intentTop2],
    ["Share who probably or definitely would buy at ₹60", stats.global.intentTop2Pct],
    ["Agreed to be contacted", stats.global.contactYes],
    ["Left a phone number or email", stats.global.reachable],
    [""],
    ["Buyers — mean appeal", stats.split.buyers.meanAppeal ?? ""],
    ["Buyers — share probably/definitely would buy at ₹60", stats.split.buyers.intentTop2Pct],
    ["Non-buyers — mean appeal", stats.split.nonBuyers.meanAppeal ?? ""],
    ["Non-buyers — share probably/definitely would buy at ₹60", stats.split.nonBuyers.intentTop2Pct],
    [""],
    ["Do not add the first-purchase answer (Q20) to the 30-day answer (Q21). Q21 already includes the first purchase."],
    ["Treat quantities as planning inputs, not confirmed orders. Validate them with a paid trial before a commercial batch."],
    ["People who do not buy packaged cold drinks skipped the habit questions (Q5–Q10)."],
    ["Contact details are permission-based. Use them only for the purpose the person selected."],
  ];
  lines.forEach((line, index) => {
    const row = summary.addRow(line);
    if (index === 0) row.font = { bold: true, size: 16 };
  });
  summary.getColumn(1).width = 78;
  summary.getColumn(2).width = 18;

  const data = workbook.addWorksheet("Responses");
  data.addRow(COLUMNS.map((column) => column[1]));
  const header = data.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFD84A" }, name: "Calibri" };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B1228" } };
  header.alignment = { wrapText: true, vertical: "middle" };
  header.height = 32;
  COLUMNS.forEach((column, index) => {
    data.getColumn(index + 1).width = column[2];
  });

  for (const record of records) {
    const rowValues = COLUMNS.map(([key]) => {
      if (key === "statusLabel") return statusLabel(record);
      if (key === "submittedAt" && record.submittedAt) return new Date(record.submittedAt);
      if (key === "q12" && typeof record.q12 === "number") return record.q12;
      return excelSafe(record[key]);
    });
    const row = data.addRow(rowValues);
    const dateCell = row.getCell(2);
    if (dateCell.value instanceof Date) dateCell.numFmt = "yyyy-mm-dd hh:mm";
  }
  data.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, records.length + 1), column: COLUMNS.length },
  };
  data.views = [{ state: "frozen", ySplit: 1 }];

  const contactsSheet = workbook.addWorksheet("Tasting contacts");
  contactsSheet.addRow(["Name", "Phone or email", "Permission", "City and area", "Appeal (1–5)", "Likelihood at ₹60", "Submitted at"]);
  const contactHeader = contactsSheet.getRow(1);
  contactHeader.font = { bold: true, color: { argb: "FFFFD84A" } };
  contactHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B1228" } };
  for (const record of records) {
    if (typeof record.q24 !== "string" || !record.q24.startsWith("Yes")) continue;
    const row = contactsSheet.addRow([
      excelSafe(record.name),
      excelSafe(record.contact),
      excelSafe(record.q24),
      excelSafe(record.q2),
      typeof record.q12 === "number" ? record.q12 : "",
      excelSafe(record.q19),
      record.submittedAt ? new Date(record.submittedAt) : "",
    ]);
    if (row.getCell(7).value instanceof Date) row.getCell(7).numFmt = "yyyy-mm-dd hh:mm";
  }
  [22, 28, 42, 28, 16, 32, 22].forEach((width, index) => {
    contactsSheet.getColumn(index + 1).width = width;
  });
  contactsSheet.views = [{ state: "frozen", ySplit: 1 }];

  return workbook;
}

export async function workbookBuffer(records) {
  const workbook = buildWorkbook(records);
  return workbook.xlsx.writeBuffer();
}

export async function writeWorkbook(records, filePath) {
  const workbook = buildWorkbook(records);
  await workbook.xlsx.writeFile(filePath);
}
