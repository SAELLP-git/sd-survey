import { randomBytes } from "crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import { writeWorkbook } from "./excel.js";

async function readRecords(jsonPath) {
  try {
    const raw = await readFile(jsonPath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeRecords(jsonPath, records) {
  const tmp = `${jsonPath}.tmp`;
  await writeFile(tmp, JSON.stringify(records, null, 2));
  try {
    await unlink(jsonPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await rename(tmp, jsonPath);
}

async function callSheet(url, init) {
  const response = await fetch(url, { redirect: "follow", ...init });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Google Sheet returned a non-JSON reply (HTTP ${response.status}). Check the web app URL and access setting.`);
  }
  if (data.error) throw new Error(`Google Sheet error: ${data.error}`);
  return data;
}

function sheetBackend(sheetUrl, sheetSecret) {
  return {
    async list() {
      const url = `${sheetUrl}${sheetUrl.includes("?") ? "&" : "?"}secret=${encodeURIComponent(sheetSecret)}`;
      const data = await callSheet(url);
      return Array.isArray(data.responses) ? data.responses : [];
    },
    async add(record) {
      const saved = {
        ...record,
        id: `sip_${randomBytes(6).toString("hex")}`,
        submittedAt: new Date().toISOString(),
      };
      const data = await callSheet(sheetUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ secret: sheetSecret, record: saved }),
      });
      return { record: data.record || saved, duplicate: Boolean(data.duplicate) };
    },
  };
}

export async function createStore(dataDir, options = {}) {
  await mkdir(dataDir, { recursive: true });
  const sheetUrl = options.sheetUrl?.trim() || "";
  const sheetSecret = options.sheetSecret?.trim() || "";
  if (sheetUrl && !sheetSecret) throw new Error("SHEET_SECRET must be set when SHEET_WEBHOOK_URL is used.");
  const jsonPath = path.join(dataDir, "responses.json");
  const xlsxPath = path.join(dataDir, "Beverage-Survey-Responses.xlsx");
  const codePath = path.join(dataDir, "organizer-code.txt");

  let password = process.env.DASHBOARD_PASSWORD?.trim() || "";
  if (!password) {
    try {
      password = (await readFile(codePath, "utf8")).trim();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      password = randomBytes(9).toString("base64url");
      await writeFile(codePath, `${password}\n`, { flag: "wx" });
    }
  }
  if (!password) throw new Error("Dashboard password is empty.");

  let queue = Promise.resolve();
  function lock(fn) {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  if (sheetUrl) {
    const sheet = sheetBackend(sheetUrl, sheetSecret);
    return {
      password,
      xlsxPath,
      storage: "google-sheet",
      list: () => sheet.list(),
      add: (record) => lock(() => sheet.add(record)),
    };
  }

  return {
    password,
    xlsxPath,
    storage: "local-file",
    list() {
      return lock(() => readRecords(jsonPath));
    },
    add(record) {
      return lock(async () => {
        const all = await readRecords(jsonPath);
        if (record.idempotencyKey) {
          const existing = all.find((item) => item.idempotencyKey === record.idempotencyKey);
          if (existing) return { record: existing, duplicate: true };
        }
        const saved = {
          ...record,
          id: `sip_${randomBytes(6).toString("hex")}`,
          submittedAt: new Date().toISOString(),
        };
        all.push(saved);
        await writeRecords(jsonPath, all);
        try {
          await writeWorkbook(all, xlsxPath);
        } catch (error) {
          console.error("Excel file was not updated:", error.message);
        }
        return { record: saved, duplicate: false };
      });
    },
  };
}
