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
  intensity: PARAMS.get("intensity") || localStorage.getItem("mgs_intensity") || "normal",
  palette: PARAMS.get("color") || localStorage.getItem("mgs_palette") || "green",
  hiddenFramesEnabled: PARAMS.get("hidden") !== "0",
  previewFlash: PARAMS.get("flash") === "preview",
  previewEcho: PARAMS.get("echo") === "preview",
  firstHiddenFrameMs: PARAMS.has("flash") ? [900, 1400] : [18000, 42000],
  firstEchoFrameMs: PARAMS.has("echo") ? [700, 1100] : [1800, 3600],
  hiddenFrameEveryMs: [54000, 120000],
  echoFrameEveryMs: [4200, 9000],
  hiddenFrameDurationMs: [34, 96],
  rebootEnabled: PARAMS.get("reboot") !== "0",
  previewReboot: PARAMS.get("reboot") === "preview",
  rebootEveryMs: PARAMS.get("reboot") === "preview" ? [900, 1400] : [25000, 33000],
  messages: [
    "MGS_TRANSMISSION // SIGNAL FOUND",
    "FOLLOW SIGNAL DETECTED",
    "TRACKING SUBSCRIBER NODE",
    "ПОДПИСКА СТАБИЛИЗИРУЕТ СИГНАЛ",
    "NEXT NODE: {goal}",
    "{remaining} SIGNALS LEFT TO OPEN NODE",
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
    "relay still open",
    "осталось {remaining}",
    "node почти открылся",
    "ты тоже видишь это?",
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
const datamosh = document.querySelector("#datamosh");
const signalWarp = document.querySelector("#signalWarp");
const ghostLayer = document.querySelector("#ghostLayer");
const rebootOverlay = document.querySelector("#rebootOverlay");
const bootStream = document.querySelector("#bootStream");
const darkToggle = document.querySelector("#darkToggle");
const greenTheme = document.querySelector("#greenTheme");
const blueTheme = document.querySelector("#blueTheme");
const archiveEntry = document.querySelector("#archiveEntry");
const archiveTrail = document.querySelector("#archiveTrail");
const mainMessage = document.querySelector("#mainMessage");
const trackingState = document.querySelector("#trackingState");
const signalStage = document.querySelector("#signalStage");
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
const signalPrompt = document.querySelector("#signalPrompt");
const goalCount = document.querySelector("#goalCount");
const goalFill = document.querySelector("#goalFill");
const frequencyLocator = document.querySelector("#frequencyLocator");
const frequencyPeaks = document.querySelector("#frequencyPeaks");
const captureText = document.querySelector("#captureText");
const progressLine = document.querySelector("#progressLine");
const remainingLine = document.querySelector("#remainingLine");

let followers = CONFIG.followerCount;
let lastMessage = "";
let liveEchoLines = [];

const BOOT_LINES = [
  "sync.follow_node({followers}/{goal})",
  "carrier.scan --band=mg_sound --lock={progress}%",
  "archive.entry #{archive} handshake accepted",
  "subscribers.left = {remaining}",
  "vhs.clock drift corrected +00.021",
  "node.cache restore /tmp/mgs/follow.lock",
  "signal.locator sweep_channel[03]",
  "crt.phosphor warmup: stable",
  "comment.echo buffer rebuilt",
  "freq.range 29.97hz -> 30.01hz",
  "transmission.relay reconnecting",
  "boot.sequence open_channel=true",
  "datamosh.frame repair skipped",
  "analog tear compensation online",
  "follow.intent pulse detected",
  "listener.shadow index refreshed",
  "goal.node {goal} awaiting lock",
  "mgs_terminal reboot vector ok",
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function applyDisplayMode() {
  const intensity = CONFIG.intensity === "dark" ? "dark" : "normal";
  const palette = CONFIG.palette === "blue" ? "blue" : "green";
  terminal.dataset.intensity = intensity;
  terminal.dataset.palette = palette;
  darkToggle.setAttribute("aria-pressed", String(intensity === "dark"));
  greenTheme.setAttribute("aria-pressed", String(palette === "green"));
  blueTheme.setAttribute("aria-pressed", String(palette === "blue"));
}

function bindControls() {
  darkToggle.addEventListener("click", () => {
    CONFIG.intensity = CONFIG.intensity === "dark" ? "normal" : "dark";
    localStorage.setItem("mgs_intensity", CONFIG.intensity);
    applyDisplayMode();
  });

  greenTheme.addEventListener("click", () => {
    CONFIG.palette = "green";
    localStorage.setItem("mgs_palette", CONFIG.palette);
    applyDisplayMode();
  });

  blueTheme.addEventListener("click", () => {
    CONFIG.palette = "blue";
    localStorage.setItem("mgs_palette", CONFIG.palette);
    applyDisplayMode();
  });
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

function archiveNumber(value, offset = 0) {
  const size = Math.max(3, String(value).length);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return value;
  return String(Math.max(0, parsed + offset)).padStart(size, "0");
}

function stageFor(percent) {
  if (percent < 30) return { key: "weak", label: "WEAK SIGNAL" };
  if (percent < 60) return { key: "partial", label: "PARTIAL LOCK" };
  if (percent < 90) return { key: "forming", label: "CHANNEL FORMING" };
  return { key: "final", label: "FINAL NODE OPENING" };
}

function renderTemplate(text) {
  return text
    .replaceAll("{archive}", CONFIG.archiveEntry)
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
  scheduleMessage.timer = window.setTimeout(() => setMessage(), randomBetween(9000, 21000));
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

function renderFrequencyPeaks(percent = progressPercent()) {
  const count = 84;
  const lockIndex = Math.round((percent / 100) * count);
  const nodes = Array.from({ length: count }, (_, index) => {
    const peak = document.createElement("span");
    const distance = Math.abs(index - lockIndex);
    const focus = Math.max(0, 1 - distance / 18);
    const random = Math.random();
    const height = Math.round(10 + random * 42 + focus * 50);
    peak.style.setProperty("--peak", `${height}%`);
    peak.style.setProperty("--peak-alpha", String(0.14 + random * 0.18 + focus * 0.24));
    peak.style.setProperty("--peak-speed", `${(2.1 + random * 2.4).toFixed(2)}s`);
    peak.style.setProperty("--peak-delay", `${(-random * 2.8).toFixed(2)}s`);
    return peak;
  });
  frequencyPeaks.replaceChildren(...nodes);
}

function updateGoal() {
  const node = progressPercent();
  const remaining = remainingFollowers();
  const signal = randomBetween(34, 68);
  const followLock = Math.max(6, Math.min(100, node + randomBetween(-3, 7)));
  const stage = stageFor(node);

  followerCount.textContent = formatNumber(followers);
  signalPrompt.textContent = remaining
    ? `RELAY NODE / ${formatNumber(remaining)} UNTIL OPEN`
    : "NODE OPEN // SIGNAL COMPLETE";
  goalCount.textContent = formatNumber(CONFIG.nodeGoal);
  goalFill.style.width = `${node}%`;
  frequencyLocator.style.setProperty("--lock", `${node}%`);
  captureText.textContent = `${node}% CAPTURE`;
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
  terminal.dataset.stage = stage.key;
  signalStage.textContent = stage.label;
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
    `RELAY NODE / ${formatNumber(remaining)} LEFT`,
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
  hiddenFlash.textContent = renderTemplate(randomItem(CONFIG.hiddenFrames));
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

function echoLine() {
  if (liveEchoLines.length && Math.random() < 0.72) {
    return randomItem(liveEchoLines);
  }

  return randomItem(CONFIG.openChannelLines);
}

function ghostPosition() {
  const zones = window.innerWidth < window.innerHeight
    ? [
        { x: [50, 76], y: [16, 28] },
        { x: [42, 74], y: [44, 58] },
        { x: [10, 34], y: [66, 78] },
        { x: [34, 66], y: [72, 84] },
      ]
    : [
        { x: [43, 58], y: [14, 25] },
        { x: [50, 68], y: [36, 50] },
        { x: [16, 38], y: [62, 74] },
        { x: [58, 76], y: [67, 80] },
        { x: [30, 48], y: [8, 17] },
      ];
  const zone = randomItem(zones);
  return {
    x: randomBetween(zone.x[0], zone.x[1]),
    y: randomBetween(zone.y[0], zone.y[1]),
  };
}

function spawnGhostComment(scheduleNext = true) {
  const line = echoLine();
  const ghost = document.createElement("div");
  const position = ghostPosition();
  const duration = CONFIG.previewEcho ? 7800 : randomBetween(6200, 11800);
  const size = randomBetween(170, 340) / 100;
  ghost.className = "ghost-comment";

  if (typeof line === "string") {
    ghost.textContent = renderTemplate(line);
  } else {
    ghost.textContent = renderTemplate(line.text);
    if (line.handle) {
      const handle = document.createElement("b");
      handle.textContent = line.handle;
      ghost.append(handle);
    }
  }

  ghost.style.left = `${position.x}%`;
  ghost.style.top = `${position.y}%`;
  ghost.style.setProperty("--ghost-size", `clamp(${size * 0.62}rem, ${size}vw, ${size * 1.45}rem)`);
  ghost.style.setProperty("--ghost-duration", `${duration}ms`);
  ghost.style.setProperty("--ghost-opacity", String(randomBetween(72, 94) / 100));
  ghost.style.setProperty("--ghost-drift-x", `${randomBetween(-24, 24)}px`);
  ghostLayer.append(ghost);
  window.setTimeout(() => ghost.remove(), duration + 500);

  if (!CONFIG.previewEcho && Math.random() < 0.22) {
    window.setTimeout(() => spawnGhostComment(false), randomBetween(700, 1700));
  }
  if (Math.random() < 0.32) triggerDatamosh();
  if (scheduleNext) scheduleEchoFrame();
}

function scheduleEchoFrame(initial = false) {
  const [min, max] = initial ? CONFIG.firstEchoFrameMs : CONFIG.echoFrameEveryMs;
  window.setTimeout(spawnGhostComment, randomBetween(min, max));
}

function triggerDatamosh() {
  datamosh.style.setProperty("--smash-top", `${randomBetween(0, 34)}%`);
  datamosh.style.setProperty("--smash-bottom", `${randomBetween(8, 55)}%`);
  datamosh.style.setProperty("--smash-x", `${randomBetween(-10, 10)}px`);
  datamosh.style.setProperty("--smash-y", `${randomBetween(-28, 18)}px`);
  datamosh.classList.remove("active");
  void datamosh.offsetWidth;
  datamosh.classList.add("active");
  window.setTimeout(() => datamosh.classList.remove("active"), randomBetween(340, 720));
}

function triggerSignalWarp() {
  const direction = Math.random() < 0.5 ? "active-down" : "active-up";
  signalWarp.classList.remove("active-down", "active-up");
  terminal.classList.remove("warping");
  void signalWarp.offsetWidth;
  signalWarp.classList.add(direction);
  terminal.classList.add("warping");
  window.setTimeout(() => {
    signalWarp.classList.remove(direction);
    terminal.classList.remove("warping");
  }, 1350);
}

function triggerColorSplit() {
  terminal.classList.remove("color-split");
  void terminal.offsetWidth;
  terminal.classList.add("color-split");
  window.setTimeout(() => terminal.classList.remove("color-split"), 1350);
}

function populateRebootStream() {
  if (!bootStream) return;

  const lineCount = window.innerWidth < 760 ? 30 : 46;
  const nodes = Array.from({ length: lineCount }, (_, index) => {
    const line = document.createElement("span");
    const columnShift = index % 3 === 0 ? 4 : index % 3 === 1 ? 18 : 38;
    const top = randomBetween(4, 92);
    const delay = randomBetween(0, 3600);
    const speed = randomBetween(1200, 2600);
    const opacity = randomBetween(42, 82) / 100;
    const size = randomBetween(78, 112) / 100;

    line.className = "boot-line";
    if (Math.random() < 0.18) line.classList.add("is-hot");
    line.textContent = renderTemplate(randomItem(BOOT_LINES));
    line.style.setProperty("--boot-left", `${columnShift + randomBetween(-6, 10)}%`);
    line.style.setProperty("--boot-top", `${top}%`);
    line.style.setProperty("--boot-delay", `${delay}ms`);
    line.style.setProperty("--boot-speed", `${speed}ms`);
    line.style.setProperty("--boot-opacity", String(opacity));
    line.style.setProperty("--boot-size", `${size}em`);
    return line;
  });

  bootStream.replaceChildren(...nodes);
}

function triggerReboot() {
  if (!CONFIG.rebootEnabled) return;
  populateRebootStream();
  terminal.classList.add("rebooting");
  rebootOverlay.classList.add("active");
  refreshLiveStats();
  window.setTimeout(() => {
    rebootOverlay.classList.remove("active");
    terminal.classList.remove("rebooting");
    if (bootStream) bootStream.replaceChildren();
    updateGoal();
  }, 4600);
  if (!CONFIG.previewReboot) scheduleReboot();
}

function scheduleReboot() {
  if (!CONFIG.rebootEnabled) return;
  const [min, max] = CONFIG.rebootEveryMs;
  window.setTimeout(triggerReboot, randomBetween(min, max));
}

function scheduleAnalogLag(initial = false) {
  if (initial) {
    window.setTimeout(() => scheduleAnalogLag(), randomBetween(1800, 4200));
    return;
  }
  if (Math.random() < 0.18) {
    terminal.classList.add("lagging");
    window.setTimeout(() => terminal.classList.remove("lagging"), randomBetween(90, 220));
  }
  triggerDatamosh();
  window.setTimeout(scheduleAnalogLag, randomBetween(2800, 7200));
}

function scheduleSignalWarp(initial = false) {
  if (initial) {
    window.setTimeout(() => scheduleSignalWarp(), randomBetween(6500, 12000));
    return;
  }
  triggerSignalWarp();
  window.setTimeout(scheduleSignalWarp, randomBetween(9000, 17000));
}

function scheduleColorSplit(initial = false) {
  if (initial) {
    window.setTimeout(() => scheduleColorSplit(), randomBetween(12000, 22000));
    return;
  }
  triggerColorSplit();
  window.setTimeout(scheduleColorSplit, randomBetween(15000, 31000));
}

async function refreshLiveStats() {
  if (!CONFIG.useLiveFollowers) return;

  try {
    const response = await fetch("/api/stats", { cache: "no-store" });
    const data = await response.json();
    const nextFollowers = Number(data.stats?.followers);
    if (response.ok && data.ok && Number.isFinite(nextFollowers)) {
      followers = nextFollowers;
      liveEchoLines = (data.comments || [])
        .map((comment) => ({
          text: comment.text || "",
          handle: comment.handle ? `@${comment.handle}` : comment.author || "",
        }))
        .filter((comment) => comment.text)
        .slice(0, 5);
      updateGoal();
    }
  } catch (error) {
    statusLine.textContent = "signal relay delayed";
  }
}

function init() {
  applyDisplayMode();
  bindControls();
  archiveEntry.textContent = `ARCHIVE ENTRY #${CONFIG.archiveEntry}`;
  archiveTrail.textContent = `#${archiveNumber(CONFIG.archiveEntry, -1)} / #${archiveNumber(CONFIG.archiveEntry)} / #${archiveNumber(CONFIG.archiveEntry, 1)}`;
  setMessage(CONFIG.messages[0]);
  renderFrequencyPeaks(progressPercent());
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
  scheduleEchoFrame(true);
  scheduleAnalogLag(true);
  scheduleSignalWarp(true);
  scheduleColorSplit(true);
  if (CONFIG.previewReboot) {
    window.setTimeout(triggerReboot, 120);
  } else {
    scheduleReboot();
  }
  refreshLiveStats();
  window.setInterval(refreshLiveStats, 3000);
}

init();
