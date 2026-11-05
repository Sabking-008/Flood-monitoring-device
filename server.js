"use strict";

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";
const WARNING_LEVEL = Number(process.env.WARNING_LEVEL_CM || 4);
const DANGER_LEVEL = Number(process.env.DANGER_LEVEL_CM || 6);
const LINK_TIMEOUT_MS = 15000;
const MAX_HISTORY = 100;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

let latest = null;
let history = [];
let previousFloodStatus = "WAITING";
let previousVibrationActive = false;

function getFloodStatus(levels) {
  const valid = levels.filter(v => Number.isFinite(v));
  if (valid.length === 0) return "SENSOR_ERROR";
  if (valid.some(v => v >= DANGER_LEVEL)) return "CRITICAL";
  if (valid.some(v => v >= WARNING_LEVEL)) return "WARNING";
  return "NORMAL";
}

function addEvent(type, message, details = {}) {
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    message,
    time: new Date().toISOString(),
    details
  });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
}

function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({
      error: "Server API_KEY is not configured. Set it in Render environment variables."
    });
  }

  const supplied = req.get("X-API-Key") || "";
  if (supplied !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized: invalid API key." });
  }
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Nepal Flood & Vibration Monitor" });
});

app.post("/api/telemetry", requireApiKey, (req, res) => {
  const body = req.body || {};
  const levels = body.levels;

  if (!Array.isArray(levels) || levels.length !== 3) {
    return res.status(400).json({ error: "levels must be an array of exactly 3 values." });
  }

  const cleanLevels = levels.map(value => {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= 400 ? n : null;
  });

  const rainValue = Number(body.rainValue);
  if (!Number.isInteger(rainValue) || rainValue < 0 || rainValue > 1023) {
    return res.status(400).json({ error: "rainValue must be an integer from 0 to 1023." });
  }

  const vibrationActive = body.vibrationActive === true;
  const vibrationEvent = body.vibrationEvent === true;
  const sequence = Number(body.sequence);

  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    return res.status(400).json({ error: "sequence must be a non-negative integer." });
  }

  const floodStatus = getFloodStatus(cleanLevels);
  const now = new Date();

  latest = {
    sequence,
    levels: cleanLevels,
    rainValue,
    vibrationActive,
    vibrationEvent,
    floodStatus,
    receivedAt: now.toISOString(),
    receivedAtMs: now.getTime()
  };

  if (floodStatus !== previousFloodStatus &&
      ["WARNING", "CRITICAL", "SENSOR_ERROR"].includes(floodStatus)) {
    addEvent("FLOOD", `Flood status changed to ${floodStatus}`, {
      levels: cleanLevels,
      status: floodStatus
    });
  }
  previousFloodStatus = floodStatus;

  if (vibrationEvent || (vibrationActive && !previousVibrationActive)) {
    addEvent("VIBRATION", "Vibration detected by SW-420 sensor", {
      active: vibrationActive,
      note: "This is a vibration detection, not a confirmed earthquake."
    });
  }
  previousVibrationActive = vibrationActive;

  return res.json({
    ok: true,
    message: "Telemetry received",
    sequence,
    floodStatus
  });
});

app.get("/api/status", (_req, res) => {
  if (!latest) {
    return res.json({
      connected: false,
      latest: null,
      thresholds: {
        warningCm: WARNING_LEVEL,
        dangerCm: DANGER_LEVEL
      }
    });
  }

  const age = Date.now() - latest.receivedAtMs;
  const connected = age <= LINK_TIMEOUT_MS;

  res.json({
    connected,
    ageMs: age,
    latest: {
      sequence: latest.sequence,
      levels: latest.levels,
      rainValue: latest.rainValue,
      vibrationActive: latest.vibrationActive,
      vibrationEvent: latest.vibrationEvent,
      floodStatus: latest.floodStatus,
      receivedAt: latest.receivedAt
    },
    thresholds: {
      warningCm: WARNING_LEVEL,
      dangerCm: DANGER_LEVEL
    }
  });
});

app.get("/api/history", (_req, res) => {
  res.json({ events: history });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Monitoring website running on port ${PORT}`);
  console.log(`Flood warning: ${WARNING_LEVEL} cm; critical: ${DANGER_LEVEL} cm`);
});
