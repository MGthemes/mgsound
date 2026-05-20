const formatter = new Intl.NumberFormat("ru-RU");
const percentFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const state = {};
const elements = Object.fromEntries(
  [...document.querySelectorAll("[data-stat]")].map((node) => [node.dataset.stat, node])
);

const avatar = document.querySelector("#avatar");
const nickname = document.querySelector("#nickname");
const statusLine = document.querySelector("#status");
const coverageLine = document.querySelector("#coverage");
const commentsList = document.querySelector("#commentsList");
const commentsStatus = document.querySelector("#commentsStatus");
let loading = false;
let lastCommentIds = [];

function formatNumber(value) {
  return formatter.format(Math.max(0, Number(value) || 0));
}

function formatValue(node, value) {
  if (node.dataset.format === "percent") {
    return `${percentFormatter.format(Math.max(0, Number(value) || 0))}%`;
  }

  return formatNumber(value);
}

function animateValue(key, nextValue) {
  const node = elements[key];
  if (!node) return;

  const from = state[key] ?? 0;
  const to = Number(nextValue) || 0;
  const hasChanged = state[key] !== undefined && from !== to;
  state[key] = to;

  const start = performance.now();
  const duration = 1150;
  const card = node.closest(".stat");

  if (hasChanged && card) {
    card.classList.remove("is-updated");
    void card.offsetWidth;
    card.classList.add("is-updated");
    window.setTimeout(() => card.classList.remove("is-updated"), 1300);
  }

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    node.textContent = formatValue(node, current);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function formatTime(iso) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function formatCommentTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function renderComments(comments = []) {
  if (!comments.length) {
    commentsStatus.textContent = "Нет данных";
    commentsList.replaceChildren();
    return;
  }

  const nextIds = comments.map((comment) => comment.id).filter(Boolean);
  const nodes = comments.map((comment) => {
    const item = document.createElement("article");
    item.className = "comment";
    if (!lastCommentIds.includes(comment.id)) {
      item.classList.add("is-new");
    }

    const avatarNode = document.createElement("img");
    avatarNode.className = "comment-avatar";
    avatarNode.alt = "";
    avatarNode.src = comment.avatar || avatar.src || "";

    const body = document.createElement("div");
    body.className = "comment-body";

    const top = document.createElement("div");
    top.className = "comment-top";

    const author = document.createElement("span");
    author.className = "comment-author";
    author.textContent = comment.author || "TikTok user";

    const time = document.createElement("span");
    time.className = "comment-time";
    time.textContent = formatCommentTime(comment.createdAt);

    const text = document.createElement("p");
    text.className = "comment-text";
    text.textContent = comment.text || "Комментарий без текста";

    const likes = document.createElement("span");
    likes.className = "comment-likes";
    likes.textContent = comment.likes ? `♥ ${formatNumber(comment.likes)}` : "";

    const video = document.createElement("a");
    video.className = "comment-video";
    video.href = comment.videoUrl || "https://www.tiktok.com/@mg_sound1";
    video.target = "_blank";
    video.rel = "noreferrer";
    video.textContent = "Видео";

    top.append(author, time);
    body.append(top, text);
    if (likes.textContent) body.append(likes);

    item.append(avatarNode, body, video);
    return item;
  });

  commentsList.replaceChildren(...nodes);
  commentsStatus.textContent = `${comments.length}/5`;
  lastCommentIds = nextIds;
}

async function loadStats() {
  if (loading) return;
  loading = true;

  try {
    statusLine.textContent = "Синхронизация...";
    const response = await fetch("/api/stats", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось получить статистику");
    }

    if (data.account?.avatar) avatar.src = data.account.avatar;
    if (data.account?.nickname) nickname.textContent = data.account.nickname;

    Object.entries(data.stats || {}).forEach(([key, value]) => animateValue(key, value));

    const stale = data.stale ? "данные из кэша, " : "";
    statusLine.textContent = `${stale}обновлено ${formatTime(data.updatedAt)}`;
    coverageLine.textContent = `${data.coverage.videosSeen}/${data.coverage.videosTotal} видео`;
    renderComments(data.comments || []);
  } catch (error) {
    statusLine.textContent = error.message;
  } finally {
    loading = false;
  }
}

loadStats();
setInterval(loadStats, 3000);
