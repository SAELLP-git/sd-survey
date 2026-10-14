import ExcelJS from "exceljs";
import { summarize } from "../shared/stats.js";

const COLUMNS = [
  ["id", "Response ID", 16],
  ["submittedAt", "Completed at", 22],
  ["startedAt", "Started at", 22],
  ["surveyVersion", "Survey version", 14],
  ["statusLabel", "Status", 24],
  ["buyer", "Packaged-drink buyer", 18],
  ["q1", "Q1 Age group", 16],
  ["q2", "Q2 City and area", 28],
  ["q3", "Q3 Household income", 28],
  ["q4", "Q4 How often they buy packaged cold drinks", 36],
  ["q6", "Q6 Drinks bought most often", 42],
  ["q6Other", "Q6 Other drink", 24],
  ["q7", "Q7 Where they buy", 36],
  ["q7Other", "Q7 Other place", 24],
  ["q8", "Q8 Choice factors", 36],
  ["q8Other", "Q8 Other factor", 24],
  ["q9", "Q9 Saffron familiarity", 28],
  ["q10", "Q10 Saffron associations", 36],
  ["q10Other", "Q10 Other association", 24],
  ["q11", "Q11 Concept appeal (1–5)", 18],
  ["q12", "Q12 Expected benefits", 42],
  ["q12Other", "Q12 Other expectation", 24],
  ["q13", "Q13 Taste experience", 28],
  ["q15", "Q15 Sweetness", 24],
  ["q18", "Q18 Fair price for 250 ml", 28],
  ["q22", "Q22 Repeat frequency if they like it", 32],
  ["q23", "Q23 Positioning", 28],
  ["q23Code", "Q23 Positioning code", 16],
  ["q24", "Q24 Switch motivation", 42],
  ["q24Other", "Q24 Other motivation", 24],
  ["q25", "Q25 Purchase barriers", 42],
  ["q25Other", "Q25 Other barrier", 24],
  ["q27", "Q27 Contact permission", 40],
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
    ["Shree Aabhaan Epicurean — saffron beverage survey"],
    ["Fair price is what people say a premium 250 ml saffron drink should cost. It is not a pricing recommendation."],
    [""],
    ["Completed responses", stats.global.completed],
    ["Screened out (under 18)", stats.global.screened],
    ["Buy packaged cold drinks", stats.global.buyers],
    ["Do not buy packaged cold drinks", stats.global.nonBuyers],
    ["Concept appeal 4 or 5", stats.global.appealTop2],
    ["Share with concept appeal 4 or 5", stats.global.appealTop2Pct],
    ["Fair price of ₹60 or more", stats.global.fairAtLeast60],
    ["Share with a fair price of ₹60 or more", stats.global.fairAtLeast60Pct],
    ["Agreed to be contacted", stats.global.contactYes],
    ["Left a phone number or email", stats.global.reachable],
    [""],
    ["Repeat frequency assumes they like the drink. Do not turn it into a sales forecast."],
    ["People who do not buy packaged cold drinks skipped the current-drink questions."],
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
      if ((key === "submittedAt" || key === "startedAt") && record[key]) return new Date(record[key]);
      if (key === "q11" && typeof record.q11 === "number") return record.q11;
      return excelSafe(record[key]);
    });
    const row = data.addRow(rowValues);
    for (const column of [2, 3]) {
      const dateCell = row.getCell(column);
      if (dateCell.value instanceof Date) dateCell.numFmt = "yyyy-mm-dd hh:mm";
    }
  }
  data.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, records.length + 1), column: COLUMNS.length },
  };
  data.views = [{ state: "frozen", ySplit: 1 }];

  const contactsSheet = workbook.addWorksheet("Tasting contacts");
  contactsSheet.addRow(["Name", "Phone or email", "Permission", "City and area", "Appeal (1–5)", "Submitted at"]);
  const contactHeader = contactsSheet.getRow(1);
  contactHeader.font = { bold: true, color: { argb: "FFFFD84A" } };
  contactHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B1228" } };
  for (const record of records) {
    if (typeof record.q27 !== "string" || !record.q27.startsWith("Yes")) continue;
    const row = contactsSheet.addRow([
      excelSafe(record.name),
      excelSafe(record.contact),
      excelSafe(record.q27),
      excelSafe(record.q2),
      typeof record.q11 === "number" ? record.q11 : "",
      record.submittedAt ? new Date(record.submittedAt) : "",
    ]);
    if (row.getCell(6).value instanceof Date) row.getCell(6).numFmt = "yyyy-mm-dd hh:mm";
  }
  [22, 28, 42, 28, 16, 22].forEach((width, index) => {
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
