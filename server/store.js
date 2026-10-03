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

export async function createStore(dataDir) {
  await mkdir(dataDir, { recursive: true });
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

  return {
    password,
    xlsxPath,
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
