const formatter = new Intl.NumberFormat("ru-RU");
const percentFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const state = {};
const elements = Object.fromEntries(
  [...document.querySelectorAll("[data-stat]")].map((node) => [node.dataset.stat, node])
);
const deltaElements = Object.fromEntries(
  [...document.querySelectorAll("[data-delta]")].map((node) => [node.dataset.delta, node])
);

const avatar = document.querySelector("#avatar");
const nickname = document.querySelector("#nickname");
const statusLine = document.querySelector("#status");
const coverageLine = document.querySelector("#coverage");
const hourlyChart = document.querySelector("#hourlyChart");
const hourlyChartEmpty = document.querySelector("#hourlyChartEmpty");
const hourlyChartStatus = document.querySelector("#hourlyChartStatus");
const topVideosList = document.querySelector("#topVideosList");
const topVideosStatus = document.querySelector("#topVideosStatus");
const commentsList = document.querySelector("#commentsList");
const commentsStatus = document.querySelector("#commentsStatus");
let loading = false;
let lastCommentIds = [];
let lastTopVideoIds = [];
let lastHourlySignature = "";

function formatNumber(value) {
  return formatter.format(Math.max(0, Math.round(Number(value) || 0)));
}

function formatValue(node, value) {
  if (node.dataset.format === "percent") {
    return `${percentFormatter.format(Math.max(0, Number(value) || 0))}%`;
  }

  return formatNumber(value);
}

function formatDelta(node, value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "+";
  const absolute = Math.abs(number);

  if (node.dataset.format === "percent") {
    return `Сегодня ${sign}${percentFormatter.format(absolute)} п.п.`;
  }

  return `Сегодня ${sign}${formatter.format(Math.round(absolute))}`;
}

function renderDeltas(delta = {}) {
  Object.entries(deltaElements).forEach(([key, node]) => {
    const value = Number(delta[key]) || 0;
    node.textContent = formatDelta(node, value);
    node.classList.toggle("is-positive", value > 0);
    node.classList.toggle("is-negative", value < 0);
    node.title = "Прирост от первого замера за сегодня";
  });
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

function formatSignedCount(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "+";
  return `${sign}${formatter.format(Math.abs(Math.round(number)))}`;
}

function makeSvgElement(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function linePath(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function areaPath(points, baselineY) {
  if (!points.length) return "";
  return [
    linePath(points),
    `L ${points[points.length - 1].x.toFixed(2)} ${baselineY}`,
    `L ${points[0].x.toFixed(2)} ${baselineY}`,
    "Z",
  ].join(" ");
}

function pointsForSeries(history, key, laneTop, laneBottom, chart) {
  const maxValue = Math.max(...history.map((item) => Number(item[key]) || 0), 1);
  return history.map((item) => {
    const hour = Math.min(23, Math.max(0, Number(item.hour) || 0));
    const value = Math.max(0, Number(item[key]) || 0);
    const x = chart.left + (hour / 23) * (chart.right - chart.left);
    const y = laneBottom - (value / maxValue) * (laneBottom - laneTop);
    return { x, y, value, hour };
  });
}

function appendSeries(svg, points, key, laneBottom, gradientId) {
  if (!points.length) return;

  const area = makeSvgElement("path", {
    class: "chart-area",
    d: areaPath(points, laneBottom),
    fill: `url(#${gradientId})`,
  });
  const path = makeSvgElement("path", {
    class: `chart-line ${key}`,
    d: linePath(points),
  });

  svg.append(area, path);

  points.forEach((point) => {
    const dot = makeSvgElement("circle", {
      class: `chart-point ${key}`,
      cx: point.x.toFixed(2),
      cy: point.y.toFixed(2),
      r: points.length === 1 ? 4.5 : 3.4,
    });
    svg.append(dot);
  });
}

function renderHourlyChart(history = [], updatedAt) {
  if (!hourlyChart || !hourlyChartEmpty || !hourlyChartStatus) return;

  let cleanHistory = history
    .map((item) => ({
      hour: Number(item.hour),
      label: item.label || `${String(item.hour).padStart(2, "0")}:00`,
      views: Math.max(0, Number(item.views) || 0),
      likes: Math.max(0, Number(item.likes) || 0),
    }))
    .filter((item) => Number.isFinite(item.hour) && item.hour >= 0 && item.hour <= 23)
    .sort((a, b) => a.hour - b.hour);
  const recordedPoints = cleanHistory.length;

  hourlyChart.replaceChildren();

  if (!recordedPoints) {
    hourlyChartEmpty.classList.remove("is-hidden");
    hourlyChartStatus.textContent = "жду первый срез";
    return;
  }

  if (cleanHistory[0].hour > 0) {
    cleanHistory = [{ hour: 0, label: "00:00", views: 0, likes: 0 }, ...cleanHistory];
  }

  hourlyChartEmpty.classList.add("is-hidden");

  const signature = cleanHistory.map((item) => `${item.hour}:${item.views}:${item.likes}`).join("|");
  const chartCard = hourlyChart.closest(".chart-card");
  if (lastHourlySignature && signature !== lastHourlySignature && chartCard) {
    chartCard.classList.remove("is-updated");
    void chartCard.offsetWidth;
    chartCard.classList.add("is-updated");
    window.setTimeout(() => chartCard.classList.remove("is-updated"), 1500);
  }
  lastHourlySignature = signature;

  const chart = {
    width: 760,
    height: 240,
    left: 68,
    right: 724,
    viewsTop: 34,
    viewsBottom: 104,
    likesTop: 136,
    likesBottom: 204,
  };

  const defs = makeSvgElement("defs");
  const viewsGradient = makeSvgElement("linearGradient", {
    id: "viewsArea",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1",
  });
  viewsGradient.append(
    makeSvgElement("stop", { offset: "0%", "stop-color": "rgba(32, 213, 210, 0.58)" }),
    makeSvgElement("stop", { offset: "100%", "stop-color": "rgba(32, 213, 210, 0)" })
  );

  const likesGradient = makeSvgElement("linearGradient", {
    id: "likesArea",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1",
  });
  likesGradient.append(
    makeSvgElement("stop", { offset: "0%", "stop-color": "rgba(255, 59, 92, 0.52)" }),
    makeSvgElement("stop", { offset: "100%", "stop-color": "rgba(255, 59, 92, 0)" })
  );
  defs.append(viewsGradient, likesGradient);
  hourlyChart.append(defs);

  [chart.viewsTop, chart.viewsBottom, chart.likesTop, chart.likesBottom].forEach((y) => {
    hourlyChart.append(makeSvgElement("line", {
      class: "chart-grid-line",
      x1: chart.left,
      x2: chart.right,
      y1: y,
      y2: y,
    }));
  });

  [0, 6, 12, 18, 23].forEach((hour) => {
    const x = chart.left + (hour / 23) * (chart.right - chart.left);
    hourlyChart.append(makeSvgElement("line", {
      class: "chart-grid-line",
      x1: x,
      x2: x,
      y1: chart.viewsTop - 8,
      y2: chart.likesBottom + 8,
    }));
    const label = makeSvgElement("text", {
      class: "chart-axis-label",
      x,
      y: 228,
      "text-anchor": hour === 0 ? "start" : hour === 23 ? "end" : "middle",
    });
    label.textContent = `${String(hour).padStart(2, "0")}:00`;
    hourlyChart.append(label);
  });

  const viewsPoints = pointsForSeries(cleanHistory, "views", chart.viewsTop, chart.viewsBottom, chart);
  const likesPoints = pointsForSeries(cleanHistory, "likes", chart.likesTop, chart.likesBottom, chart);
  appendSeries(hourlyChart, viewsPoints, "views", chart.viewsBottom, "viewsArea");
  appendSeries(hourlyChart, likesPoints, "likes", chart.likesBottom, "likesArea");

  const latest = cleanHistory[cleanHistory.length - 1];
  const labels = [
    ["Просмотры", chart.viewsTop + 12, `+${formatNumber(latest.views)}`],
    ["Лайки", chart.likesTop + 12, `+${formatNumber(latest.likes)}`],
  ];

  labels.forEach(([labelText, y, value]) => {
    const label = makeSvgElement("text", {
      class: "chart-lane-label",
      x: 16,
      y,
    });
    label.textContent = labelText;
    const valueLabel = makeSvgElement("text", {
      class: "chart-value-label",
      x: chart.right,
      y,
      "text-anchor": "end",
    });
    valueLabel.textContent = value;
    hourlyChart.append(label, valueLabel);
  });

  hourlyChartStatus.textContent = `${recordedPoints} ч. · обновлено ${formatTime(updatedAt || new Date().toISOString())}`;
}

function renderTopVideos(videos = []) {
  if (!topVideosList || !topVideosStatus) return;

  if (!videos.length) {
    topVideosStatus.textContent = "Нет данных";
    topVideosList.replaceChildren();
    return;
  }

  const hasMomentum = videos.some((video) => Number(video.score) > 0);
  const maxScore = Math.max(...videos.map((video) => Number(video.score) || 0), 1);
  const nextIds = videos.map((video) => video.id || video.url).filter(Boolean);

  const nodes = videos.map((video, index) => {
    const delta = video.delta || {};
    const score = Math.max(0, Number(video.score) || 0);
    const item = document.createElement("article");
    item.className = "top-video";
    if (!lastTopVideoIds.includes(video.id || video.url) && hasMomentum) {
      item.classList.add("is-new");
    }

    const rank = document.createElement("span");
    rank.className = "top-video-rank";
    rank.textContent = `#${video.rank || index + 1}`;

    const body = document.createElement("div");
    body.className = "top-video-body";

    const title = document.createElement(video.url ? "a" : "span");
    title.className = "top-video-title";
    title.textContent = video.title || "Видео без названия";
    if (video.url) {
      title.href = video.url;
      title.target = "_blank";
      title.rel = "noreferrer";
    }

    const metrics = document.createElement("div");
    metrics.className = "top-video-metrics";

    const views = document.createElement("span");
    views.innerHTML = `<b>${formatSignedCount(delta.views)}</b> просмотры`;

    const interactions = document.createElement("span");
    interactions.innerHTML = `<b>${formatSignedCount(delta.interactions)}</b> взаимодействия`;

    const details = document.createElement("span");
    details.className = "top-video-details";
    details.textContent = [
      `${formatSignedCount(delta.likes)} лайки`,
      `${formatSignedCount(delta.comments)} комм.`,
      `${formatSignedCount(delta.shares)} шеры`,
    ].join(" · ");

    metrics.append(views, interactions, details);

    const bar = document.createElement("div");
    bar.className = "top-video-bar";
    const fill = document.createElement("span");
    fill.style.width = hasMomentum ? `${Math.max(4, (score / maxScore) * 100)}%` : "0%";
    bar.append(fill);

    body.append(title, metrics, bar);
    item.append(rank, body);
    return item;
  });

  topVideosList.replaceChildren(...nodes);
  topVideosStatus.textContent = hasMomentum ? `${videos.length}/5` : "жду прирост";
  lastTopVideoIds = nextIds;
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
    renderDeltas(data.todayDelta || {});
    renderHourlyChart(data.hourlyHistory || [], data.updatedAt);

    const stale = data.stale ? "данные из кэша, " : "";
    statusLine.textContent = `${stale}обновлено ${formatTime(data.updatedAt)}`;
    coverageLine.textContent = `${data.coverage.videosSeen}/${data.coverage.videosTotal} видео`;
    renderTopVideos(data.topToday || []);
    renderComments(data.comments || []);
  } catch (error) {
    statusLine.textContent = error.message;
  } finally {
    loading = false;
  }
}

loadStats();
setInterval(loadStats, 3000);
