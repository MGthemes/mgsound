const PARAMS = new URLSearchParams(location.search);
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

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
  followerCount: Number(PARAMS.get("followers") || PARAMS.get("listeners")) || 293,
  useLiveFollowers: PARAMS.get("live") !== "0",
  nodeGoal: Number(PARAMS.get("goal")) || 1000,
  hiddenFramesEnabled: PARAMS.get("hidden") !== "0",
  previewFlash: PARAMS.get("flash") === "preview",
  firstHiddenFrameMs: PARAMS.has("flash") ? [900, 1400] : [18000, 42000],
  hiddenFrameEveryMs: [32000, 76000],
  hiddenFrameDurationMs: [34, 620],
  messages: [
    "MGS_TRANSMISSION // SIGNAL FOUND",
    "FOLLOW SIGNAL DETECTED",
    "TRACKING SUBSCRIBER NODE",
    "ПОДПИСКА СТАБИЛИЗИРУЕТ СИГНАЛ",
    "NEXT NODE: {goal}",
    "СИГНАЛ НЕСТАБИЛЕН",
    "КТО-ТО ПОДКЛЮЧИЛСЯ",
    "КАНАЛ НЕ ЗАКРЫТ",
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
    "> follow signal scanned",
    "> node response delayed",
    "> archive pulse stable",
    "> subscriber channel open",
    "> carrier tone detected",
    "> signal drift corrected",
  ],
  openChannelLines: [
    "кто ещё тут",
    "атмосфера..",
    "будто 2007",
    "не выключай экран",
    "кто-то ещё слушает",
    "signal stable",
    "я слышу это",
    "канал живой",
    "подпишись чтобы сигнал не пропал",
  ],
  hiddenFrames: [
    "ТЫ ЭТО УВИДЕЛ?",
    "НЕ ПЕРЕМАТЫВАЙ",
    "WAKE UP",
    "USER_FOUND",
    "FOLLOW SIGNAL",
    "NODE OPENS AT {goal}",
  ],
};

const terminal = document.querySelector(".terminal");
const archiveEntry = document.querySelector("#archiveEntry");
const mainMessage = document.querySelector("#mainMessage");
const trackingState = document.querySelector("#trackingState");
const connectionLog = document.querySelector("#connectionLog");
const listenerLine = document.querySelector("#listenerLine");
const statusLine = document.querySelector("#statusLine");
const hiddenFlash = document.querySelector("#hiddenFlash");
const signalQuality = document.querySelector("#signalQuality");
const archiveLoading = document.querySelector("#archiveLoading");
const nodeExpansion = document.querySelector("#nodeExpansion");
const signalText = document.querySelector("#signalText");
const archiveText = document.querySelector("#archiveText");
const nodeText = document.querySelector("#nodeText");
const followerCount = document.querySelector("#followerCount");
const goalCount = document.querySelector("#goalCount");
const goalFill = document.querySelector("#goalFill");
const progressLine = document.querySelector("#progressLine");
const remainingLine = document.querySelector("#remainingLine");

let followers = CONFIG.followerCount;
let lastMessage = "";

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function formatNumber(value) {
  return NUMBER_FORMAT.format(Math.max(0, Math.round(value)));
}

function progressPercent() {
  return Math.min(100, Math.round((followers / CONFIG.nodeGoal) * 100));
}

function remainingFollowers() {
  return Math.max(0, CONFIG.nodeGoal - followers);
}

function renderTemplate(text) {
  return text
    .replaceAll("{followers}", formatNumber(followers))
    .replaceAll("{progress}", String(progressPercent()))
    .replaceAll("{remaining}", formatNumber(remainingFollowers()))
    .replaceAll("{goal}", formatNumber(CONFIG.nodeGoal));
}

function setMessage(text = randomItem(CONFIG.messages)) {
  const next = renderTemplate(text);
  if (next === lastMessage && CONFIG.messages.length > 1) {
    return setMessage();
  }

  lastMessage = next;
  mainMessage.classList.add("glitch");
  mainMessage.textContent = next;
  window.setTimeout(() => mainMessage.classList.remove("glitch"), 480);
  scheduleMessage();
}

function scheduleMessage() {
  window.clearTimeout(scheduleMessage.timer);
  scheduleMessage.timer = window.setTimeout(() => setMessage(), randomBetween(14000, 32000));
}

function addLog(line) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = line;
  if (Math.random() < 0.28) entry.classList.add("glitch");
  connectionLog.prepend(entry);

  [...connectionLog.children].forEach((child, index) => {
    child.classList.toggle("fading", index > 8);
    if (index > 16) child.remove();
  });
}

function scheduleLog() {
  const roll = Math.random();
  let line = randomItem(CONFIG.logLines);

  if (roll < 0.48) {
    line = `USER CONNECTED:\n${randomItem(CONFIG.usernames)}`;
  } else if (roll < 0.66) {
    line = `FOLLOW LOCK:\n${progressPercent()}% / ${formatNumber(CONFIG.nodeGoal)}`;
  } else if (roll < 0.78) {
    line = `NEXT NODE WAITING:\n${formatNumber(remainingFollowers())} SIGNALS LEFT`;
  }

  addLog(line);
  window.setTimeout(scheduleLog, randomBetween(3200, 8200));
}

function textBar(percent, length = 8) {
  const filled = Math.max(0, Math.min(length, Math.round((percent / 100) * length)));
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function updateGoal() {
  const node = progressPercent();
  const remaining = remainingFollowers();
  const signal = randomBetween(34, 68);
  const followLock = Math.max(6, Math.min(100, node + randomBetween(-3, 7)));

  followerCount.textContent = formatNumber(followers);
  goalCount.textContent = formatNumber(CONFIG.nodeGoal);
  goalFill.style.width = `${node}%`;
  signalQuality.style.width = `${signal}%`;
  archiveLoading.style.width = `${followLock}%`;
  nodeExpansion.style.width = `${node}%`;
  signalText.textContent = textBar(signal, 8);
  archiveText.textContent = textBar(followLock, 8);
  nodeText.textContent = `${node}%`;
  progressLine.textContent = `${node}% SIGNAL LOCKED`;
  remainingLine.textContent = remaining
    ? `${formatNumber(remaining)} SUBS UNTIL NODE OPENS`
    : "NODE OPEN // SIGNAL COMPLETE";
  listenerLine.textContent = `${formatNumber(followers)} followers connected`;
  statusLine.textContent = randomItem([
    "searching signal",
    "tracking follow node",
    "signal unstable",
    "subscription channel open",
    "playback stable",
  ]);
  trackingState.textContent = randomItem([
    `SEARCHING FOLLOW SIGNAL / ${node}% LOCK`,
    `SCANNING NODE / ${formatNumber(remaining)} LEFT`,
    "ANALOG FOLLOW TRACE ACTIVE",
    "SUBSCRIBER SIGNAL TRACKING",
  ]);
}

function scheduleBars() {
  updateGoal();
  window.setTimeout(scheduleBars, randomBetween(3000, 6200));
}

function flashHiddenFrame() {
  if (!CONFIG.hiddenFramesEnabled) return;
  const lines = Math.random() < 0.62 ? CONFIG.openChannelLines : CONFIG.hiddenFrames;
  hiddenFlash.textContent = renderTemplate(randomItem(lines));
  hiddenFlash.classList.add("visible");

  const oneFrame = Math.random() < 0.38;
  const duration = CONFIG.previewFlash
    ? 4200
    : oneFrame
    ? CONFIG.hiddenFrameDurationMs[0]
    : randomBetween(CONFIG.hiddenFrameDurationMs[0] + 120, CONFIG.hiddenFrameDurationMs[1]);

  window.setTimeout(() => hiddenFlash.classList.remove("visible"), duration);
  scheduleHiddenFrame();
}

function scheduleHiddenFrame(initial = false) {
  if (!CONFIG.hiddenFramesEnabled) return;
  const [min, max] = initial ? CONFIG.firstHiddenFrameMs : CONFIG.hiddenFrameEveryMs;
  window.setTimeout(flashHiddenFrame, randomBetween(min, max));
}

function scheduleAnalogLag() {
  terminal.classList.add("lagging");
  window.setTimeout(() => terminal.classList.remove("lagging"), randomBetween(160, 620));
  window.setTimeout(scheduleAnalogLag, randomBetween(2800, 6800));
}

async function refreshLiveStats() {
  if (!CONFIG.useLiveFollowers) return;

  try {
    const response = await fetch("/api/stats", { cache: "no-store" });
    const data = await response.json();
    const nextFollowers = Number(data.stats?.followers);
    if (response.ok && data.ok && Number.isFinite(nextFollowers)) {
      followers = nextFollowers;
      updateGoal();
    }
  } catch (error) {
    statusLine.textContent = "signal relay delayed";
  }
}

function init() {
  archiveEntry.textContent = `ARCHIVE ENTRY #${CONFIG.archiveEntry}`;
  setMessage(CONFIG.messages[0]);
  updateGoal();

  [
    "> signal search initialized",
    `FOLLOW LOCK:\n${progressPercent()}% / ${formatNumber(CONFIG.nodeGoal)}`,
    `USER CONNECTED:\n${CONFIG.usernames[0]}`,
    `NEXT NODE WAITING:\n${formatNumber(remainingFollowers())} SIGNALS LEFT`,
  ].reverse().forEach(addLog);

  scheduleLog();
  scheduleBars();
  scheduleHiddenFrame(true);
  scheduleAnalogLag();
  refreshLiveStats();
  window.setInterval(refreshLiveStats, 3000);
}

init();
