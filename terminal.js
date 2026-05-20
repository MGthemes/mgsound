const PARAMS = new URLSearchParams(location.search);

function listParam(name, fallback) {
  const value = PARAMS.get(name);
  if (!value) return fallback;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

const CONFIG = {
  archiveEntry: PARAMS.get("archive") || "024",
  listenerCount: Number(PARAMS.get("listeners")) || 293,
  useLiveFollowers: PARAMS.get("live") !== "0",
  nodeGoal: Number(PARAMS.get("goal")) || 1000,
  hiddenFramesEnabled: PARAMS.get("hidden") !== "0",
  hiddenFrameEveryMs: [120000, 240000],
  messages: [
    "MGS_TRANSMISSION<br>SIGNAL FOUND",
    "ПОДКЛЮЧЕНО:<br>{listeners} СЛУШАТЕЛЯ",
    "СИГНАЛ НЕСТАБИЛЕН",
    "Прогресс подключения:<br>{progress}%",
    "NEXT NODE:<br>{goal}",
    "КТО-ТО ЕЩЁ СЛУШАЕТ",
    "НЕ ВЫКЛЮЧАЙ ЭКРАН",
    "ТЫ ТОЖЕ ЭТО СЛУШАЕШЬ?",
    "ПЕРЕДАЧА АКТИВНА",
    "КАНАЛ НЕ ЗАКРЫТ",
    "КТО-ТО ПОДКЛЮЧИЛСЯ",
    "ПРОСЛУШИВАНИЕ ПРОДОЛЖАЕТСЯ",
  ],
  usernames: listParam("users", [
    "@night_signal",
    "@deadchannel",
    "@lost_archive",
    "@quiet_node",
    "@vhs_angel",
    "@late_listener",
    "@mono_room",
  ]),
  logLines: [
    "> user connected",
    "> archive updated",
    "> playback stable",
    "> signal drift corrected",
    "> node response delayed",
    "> carrier tone detected",
    "> archive fragment decoded",
  ],
  feedLines: [
    "> кто ещё тут",
    "> атмосфера..",
    "> будто 2007",
    "> не выключай экран",
    "> кто-то ещё слушает",
    "> signal stable",
    "> я слышу это",
    "> канал живой",
  ],
  hiddenFrames: ["ТЫ ЭТО УВИДЕЛ?", "НЕ ПЕРЕМАТЫВАЙ", "WAKE UP", "USER_FOUND"],
};

const archiveEntry = document.querySelector("#archiveEntry");
const mainMessage = document.querySelector("#mainMessage");
const connectionLog = document.querySelector("#connectionLog");
const commentFeed = document.querySelector("#commentFeed");
const listenerLine = document.querySelector("#listenerLine");
const statusLine = document.querySelector("#statusLine");
const hiddenFlash = document.querySelector("#hiddenFlash");
const signalQuality = document.querySelector("#signalQuality");
const archiveLoading = document.querySelector("#archiveLoading");
const nodeExpansion = document.querySelector("#nodeExpansion");
const signalText = document.querySelector("#signalText");
const archiveText = document.querySelector("#archiveText");
const nodeText = document.querySelector("#nodeText");

let listenerCount = CONFIG.listenerCount;
let lastMessage = "";

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function progressPercent() {
  return Math.min(100, Math.round((listenerCount / CONFIG.nodeGoal) * 100));
}

function renderTemplate(text) {
  return text
    .replaceAll("{listeners}", String(listenerCount))
    .replaceAll("{progress}", String(progressPercent()))
    .replaceAll("{goal}", String(CONFIG.nodeGoal));
}

function setMessage(text = randomItem(CONFIG.messages)) {
  const next = renderTemplate(text);
  if (next === lastMessage && CONFIG.messages.length > 1) {
    return setMessage();
  }

  lastMessage = next;
  mainMessage.classList.add("glitch");
  mainMessage.innerHTML = next;
  window.setTimeout(() => mainMessage.classList.remove("glitch"), 480);
  scheduleMessage();
}

function scheduleMessage() {
  window.clearTimeout(scheduleMessage.timer);
  scheduleMessage.timer = window.setTimeout(() => setMessage(), randomBetween(15000, 40000));
}

function addLog(line) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = line;
  if (Math.random() < 0.18) entry.classList.add("glitch");
  connectionLog.prepend(entry);

  [...connectionLog.children].forEach((child, index) => {
    child.classList.toggle("fading", index > 7);
    if (index > 13) child.remove();
  });
}

function addFeed(line) {
  const entry = document.createElement("div");
  entry.className = "feed-entry";
  entry.textContent = line;
  if (Math.random() < 0.22) entry.classList.add("glitch");
  commentFeed.prepend(entry);

  [...commentFeed.children].forEach((child, index) => {
    child.classList.toggle("fading", index > 3);
    if (index > 7) child.remove();
  });
}

function scheduleLog() {
  const connected = Math.random() < 0.42;
  const line = connected
    ? `USER CONNECTED: ${randomItem(CONFIG.usernames)}`
    : randomItem(CONFIG.logLines);
  addLog(line);
  window.setTimeout(scheduleLog, randomBetween(4500, 11000));
}

function scheduleFeed() {
  addFeed(randomItem(CONFIG.feedLines));
  window.setTimeout(scheduleFeed, randomBetween(8000, 16000));
}

function textBar(percent, length = 8) {
  const filled = Math.max(0, Math.min(length, Math.round((percent / 100) * length)));
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function updateBars() {
  const signal = randomBetween(28, 48);
  const archive = randomBetween(24, 42);
  const node = progressPercent();
  signalQuality.style.width = `${signal}%`;
  archiveLoading.style.width = `${archive}%`;
  nodeExpansion.style.width = `${node}%`;
  signalText.textContent = textBar(signal, 8);
  archiveText.textContent = textBar(archive, 8);
  nodeText.textContent = `${node}%`;
  listenerLine.textContent = `${listenerCount} listeners connected`;
  statusLine.textContent = Math.random() < 0.2 ? "signal unstable" : "playback stable";
}

function scheduleBars() {
  updateBars();
  window.setTimeout(scheduleBars, randomBetween(5000, 12000));
}

function flashHiddenFrame() {
  if (!CONFIG.hiddenFramesEnabled) return;
  hiddenFlash.textContent = randomItem(CONFIG.hiddenFrames);
  hiddenFlash.classList.add("visible");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => hiddenFlash.classList.remove("visible"));
  });
  scheduleHiddenFrame();
}

function scheduleHiddenFrame() {
  if (!CONFIG.hiddenFramesEnabled) return;
  const [min, max] = CONFIG.hiddenFrameEveryMs;
  window.setTimeout(flashHiddenFrame, randomBetween(min, max));
}

async function refreshLiveStats() {
  if (!CONFIG.useLiveFollowers) return;

  try {
    const response = await fetch("/api/stats", { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.ok && data.stats?.followers) {
      listenerCount = Number(data.stats.followers);
      updateBars();
    }
  } catch (error) {
    statusLine.textContent = "signal relay delayed";
  }
}

function init() {
  archiveEntry.textContent = `ARCHIVE ENTRY #${CONFIG.archiveEntry}`;
  setMessage(CONFIG.messages[0]);
  updateBars();

  CONFIG.logLines.slice(0, 3).reverse().forEach(addLog);
  CONFIG.feedLines.slice(0, 3).reverse().forEach(addFeed);

  scheduleLog();
  scheduleFeed();
  scheduleBars();
  scheduleHiddenFrame();
  refreshLiveStats();
  window.setInterval(refreshLiveStats, 30000);
}

init();
