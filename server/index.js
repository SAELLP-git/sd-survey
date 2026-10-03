import { timingSafeEqual } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { validateAnswers } from "../shared/validate.js";
import { workbookBuffer } from "./excel.js";
import { createStore } from "./store.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

function cleanKey(value) {
  if (typeof value !== "string") return "";
  const key = value.trim();
  return /^[a-zA-Z0-9-]{8,80}$/.test(key) ? key : "";
}

export function createApp(store) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const allowSubmit = limiter(40, 10 * 60 * 1000);
  const allowAuthFail = limiter(12, 10 * 60 * 1000);

  function authorized(req) {
    const header = req.get("authorization") || "";
    const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    const queryKey = typeof req.query.key === "string" ? req.query.key : "";
    return safeEqual(bearer, store.password) || safeEqual(queryKey, store.password);
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/responses", async (req, res) => {
    const ip = req.ip || "unknown";
    if (!allowSubmit(ip)) {
      return res.status(429).json({ error: "Too many submissions from this network. Try again in a little while." });
    }
    const honeypot = typeof req.body?.company_website_confirm === "string" ? req.body.company_website_confirm.trim() : "";
    if (honeypot) return res.status(201).json({ ok: true });

    const result = validateAnswers(req.body?.answers);
    if (!result.ok) return res.status(400).json({ error: result.error });

    result.record.idempotencyKey = cleanKey(req.body?.idempotencyKey);
    try {
      const saved = await store.add(result.record);
      if (!saved.duplicate) {
        console.log(`Saved ${saved.record.id} (${saved.record.status})`);
      }
      return res.status(201).json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "The response could not be saved. Please try again." });
    }
  });

  app.get("/api/responses", async (req, res) => {
    if (!authorized(req)) {
      if (!allowAuthFail(req.ip || "unknown")) {
        return res.status(429).json({ error: "Too many attempts. Wait a few minutes and try again." });
      }
      return res.status(401).json({ error: "That organiser code doesn’t match." });
    }
    const responses = await store.list();
    res.json({ responses });
  });

  app.get("/api/export", async (req, res) => {
    if (!authorized(req)) {
      if (!allowAuthFail(req.ip || "unknown")) {
        return res.status(429).json({ error: "Too many attempts. Wait a few minutes and try again." });
      }
      return res.status(401).json({ error: "That organiser code doesn’t match." });
    }
    const responses = await store.list();
    const buffer = await workbookBuffer(responses);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="Beverage-Survey-Responses.xlsx"');
    res.send(Buffer.from(buffer));
  });

  app.use(express.static(distDir, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    const indexFile = path.join(distDir, "index.html");
    if (!existsSync(indexFile)) {
      return res.status(503).type("text/plain").send("The survey interface has not been built yet.");
    }
    res.sendFile(indexFile);
  });

  return app;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");
  const port = Number(process.env.PORT || 8787);
  const store = await createStore(dataDir);
  const app = createApp(store);
  app.listen(port, "0.0.0.0", () => {
    console.log(`Survey:     http://localhost:${port}`);
    console.log(`Dashboard:  http://localhost:${port}/dashboard`);
    console.log(`Excel file: ${store.xlsxPath}`);
    console.log(`Organiser code: ${store.password}`);
  });
}
