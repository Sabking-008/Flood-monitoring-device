const POLL_INTERVAL_MS = 2000;

const $ = id => document.getElementById(id);

function setConnection(connected, ageMs) {
  const dot = $("connectionDot");
  dot.className = "live-dot " + (connected ? "online" : "offline");
  $("connectionText").textContent = connected ? "DEVICE ONLINE" : "DEVICE OFFLINE";
  $("arduinoStatus").textContent = connected ? "Data received" : "Waiting";
  $("radioStatus").textContent = connected ? "Packets arriving" : "No recent packets";
  $("wifiStatus").textContent = connected ? "Gateway online" : "Unknown";
  $("arduinoStatus").className = connected ? "" : "muted";
  $("radioStatus").className = connected ? "" : "muted";
  $("wifiStatus").className = connected ? "" : "muted";

  if (connected && Number.isFinite(ageMs)) {
    $("lastUpdated").textContent = `Last packet ${Math.max(0, Math.round(ageMs / 1000))}s ago`;
  } else {
    $("lastUpdated").textContent = "Waiting for data";
  }
}

function setPill(element, text, type) {
  element.textContent = text;
  element.className = "status-pill " + type;
}

function renderWaiting() {
  $("floodStatus").textContent = "WAITING FOR DATA";
  $("floodMessage").textContent = "No recent sensor packet has reached the website.";
  setPill($("floodPill"), "NO DATA", "neutral");
  $("vibrationStatus").textContent = "NO DATA";
  $("vibrationMessage").textContent = "Waiting for the vibration sensor reading.";
  setPill($("vibrationPill"), "NOT CONNECTED", "neutral");

  for (let i = 1; i <= 3; i++) {
    $("level" + i).textContent = "--";
    $("state" + i).textContent = "—";
    $("bar" + i).style.width = "0%";
  }
  $("rainValue").textContent = "--";
  $("rainState").textContent = "—";
  $("rainBar").style.width = "0%";
  $("sequence").textContent = "—";
}

function renderStatus(data) {
  const connected = Boolean(data.connected && data.latest);
  setConnection(connected, data.ageMs);

  if (!connected) {
    renderWaiting();
    $("warningThreshold").textContent = `${data.thresholds?.warningCm ?? 4} cm`;
    $("dangerThreshold").textContent = `${data.thresholds?.dangerCm ?? 6} cm`;
    return;
  }

  const d = data.latest;
  const levels = Array.isArray(d.levels) ? d.levels : [null, null, null];

  const floodText = {
    NORMAL: ["NORMAL", "Water levels are below the configured warning threshold.", "good"],
    WARNING: ["FLOOD WARNING", "At least one water sensor has reached the warning threshold.", "warning"],
    CRITICAL: ["CRITICAL FLOOD LEVEL", "At least one water sensor has reached the critical threshold.", "danger"],
    SENSOR_ERROR: ["SENSOR ERROR", "No valid ultrasonic readings are available.", "warning"]
  }[d.floodStatus] || ["UNKNOWN", "Flood status unavailable.", "neutral"];

  $("floodStatus").textContent = floodText[0];
  $("floodMessage").textContent = floodText[1];
  setPill($("floodPill"), floodText[0], floodText[2]);

  for (let i = 0; i < 3; i++) {
    const value = levels[i];
    const index = i + 1;
    if (Number.isFinite(value)) {
      $("level" + index).textContent = value.toFixed(1);
      $("state" + index).textContent = "VALID";
      $("state" + index).style.color = "var(--green)";
      $("bar" + index).style.width = Math.min(100, Math.max(0, value / 10 * 100)) + "%";
    } else {
      $("level" + index).textContent = "--";
      $("state" + index).textContent = "ERROR";
      $("state" + index).style.color = "var(--red)";
      $("bar" + index).style.width = "0%";
    }
  }

  const rain = Number(d.rainValue);
  $("rainValue").textContent = Number.isFinite(rain) ? rain : "--";
  $("rainState").textContent = Number.isFinite(rain) ? "VALID" : "ERROR";
  $("rainBar").style.width = Number.isFinite(rain) ? (rain / 1023 * 100) + "%" : "0%";

  const vibrating = Boolean(d.vibrationActive);
  $("vibrationStatus").textContent = vibrating ? "VIBRATION DETECTED" : "NO VIBRATION";
  $("vibrationMessage").textContent = vibrating
    ? "The SW-420 module is currently detecting vibration."
    : "No vibration is currently being detected.";
  setPill($("vibrationPill"), vibrating ? "DETECTED" : "CLEAR", vibrating ? "warning" : "good");

  $("sequence").textContent = d.sequence;
  $("warningThreshold").textContent = `${data.thresholds?.warningCm ?? 4} cm`;
  $("dangerThreshold").textContent = `${data.thresholds?.dangerCm ?? 6} cm`;

  if (d.receivedAt) {
    const time = new Date(d.receivedAt);
    $("lastUpdated").textContent = "Received " + time.toLocaleTimeString();
  }
}

function renderHistory(events) {
  const list = $("historyList");
  $("historyCount").textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;

  if (!events.length) {
    list.innerHTML = '<div class="empty-state">No alerts recorded yet.</div>';
    return;
  }

  list.replaceChildren();
  for (const event of events.slice(0, 30)) {
    const item = document.createElement("div");
    item.className = "history-item";

    const dot = document.createElement("span");
    dot.className = "history-dot " + (event.type === "VIBRATION" ? "vibration" : "flood");

    const content = document.createElement("div");
    content.className = "history-content";

    const title = document.createElement("strong");
    title.textContent = event.message || "Monitoring event";

    const time = document.createElement("small");
    time.textContent = new Date(event.time).toLocaleString();

    content.append(title, time);
    item.append(dot, content);
    list.append(item);
  }
}

async function refreshDashboard() {
  try {
    const [statusResponse, historyResponse] = await Promise.all([
      fetch("/api/status", { cache: "no-store" }),
      fetch("/api/history", { cache: "no-store" })
    ]);

    if (!statusResponse.ok || !historyResponse.ok) {
      throw new Error("Server returned an error");
    }

    const status = await statusResponse.json();
    const history = await historyResponse.json();

    renderStatus(status);
    renderHistory(Array.isArray(history.events) ? history.events : []);
  } catch (error) {
    setConnection(false);
    $("floodMessage").textContent = "Cannot reach the monitoring server. Retrying automatically.";
  }
}

$("year").textContent = new Date().getFullYear();
renderWaiting();
refreshDashboard();
setInterval(refreshDashboard, POLL_INTERVAL_MS);
