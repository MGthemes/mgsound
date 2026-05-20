const FOLLOWER_GOAL = 1000;
const formatter = new Intl.NumberFormat("ru-RU");
const percentFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const avatar = document.querySelector("#avatar");
const followersNow = document.querySelector("#followersNow");
const goalFill = document.querySelector("#goalFill");
const goalGhost = document.querySelector("#goalGhost");
const goalNeedle = document.querySelector("#goalNeedle");
const goalPercent = document.querySelector("#goalPercent");
const goalRemaining = document.querySelector("#goalRemaining");
const statusLine = document.querySelector("#status");
const erValue = document.querySelector("#erValue");
let loading = false;
let currentFollowers = 0;

function formatNumber(value) {
  return formatter.format(Math.max(0, Math.round(Number(value) || 0)));
}

function animateFollowers(nextValue) {
  const from = currentFollowers;
  const to = Math.max(0, Number(nextValue) || 0);
  currentFollowers = to;

  const start = performance.now();
  const duration = 1200;

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (to - from) * eased);
    followersNow.textContent = formatNumber(current);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function updateGoal(followers) {
  const current = Math.max(0, Number(followers) || 0);
  const precisePercent = Math.min(100, (current / FOLLOWER_GOAL) * 100);
  const percent = Math.round(precisePercent);
  const remaining = Math.max(0, FOLLOWER_GOAL - current);

  animateFollowers(current);
  goalFill.style.width = `${precisePercent}%`;
  goalGhost.style.width = `${Math.min(100, precisePercent + 2.8)}%`;
  goalNeedle.style.left = `${precisePercent}%`;
  goalPercent.textContent = `${percent}% SIGNAL`;
  goalRemaining.textContent = remaining
    ? `осталось ${formatNumber(remaining)} до 1 000`
    : "цель взята";
}

function formatTime(iso) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

async function loadGoal() {
  if (loading) return;
  loading = true;

  try {
    statusLine.textContent = "синхронизация сигнала...";
    const response = await fetch("/api/stats", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "нет сигнала");
    }

    if (data.account?.avatar) avatar.src = data.account.avatar;
    updateGoal(data.stats?.followers);
    erValue.textContent = `ER ${percentFormatter.format(Number(data.stats?.er) || 0)}%`;
    statusLine.textContent = `обновлено ${formatTime(data.updatedAt)}`;
  } catch (error) {
    statusLine.textContent = error.message;
  } finally {
    loading = false;
  }
}

loadGoal();
setInterval(loadGoal, 3000);
