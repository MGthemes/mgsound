import html
import json
import os
import re
import sys
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

try:
    from yt_dlp import YoutubeDL
except ImportError as exc:
    YoutubeDL = None
    YTDLP_IMPORT_ERROR = exc
else:
    YTDLP_IMPORT_ERROR = None


USERNAME = "mg_sound1"
APP_NAME = "MG Sound Statistics"
STATS_PATH = "/mg-sound-statistics"
GOAL_PATH = "/mg-sound"
TERMINAL_PATH = "/transmission-terminal"
LEGACY_GOAL_PATH = "/teamg-sound"
CACHE_TTL_SECONDS = 3
COMMENTS_TTL_SECONDS = 60
COMMENT_VIDEO_LIMIT = 8
COMMENT_REQUEST_DELAY_SECONDS = 1.15
PLAYLIST_LIMIT = 200
ROOT = Path(__file__).resolve().parent

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

cache_lock = threading.Lock()
refresh_lock = threading.Lock()
cache = {"fetched_at": 0.0, "payload": None}
comments_cache_lock = threading.Lock()
comments_refresh_lock = threading.Lock()
comments_cache = {"fetched_at": 0.0, "items": []}


def parse_int(value):
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    return int(str(value).replace(",", "").strip() or 0)


def fetch_profile(username):
    url = f"https://www.tiktok.com/@{username}"
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    )

    with urlopen(request, timeout=20) as response:
        text = response.read().decode("utf-8", "replace")

    match = re.search(
        r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">(.*?)</script>',
        text,
        re.S,
    )
    if not match:
        raise RuntimeError("TikTok profile data was not found in the page.")

    data = json.loads(html.unescape(match.group(1)))
    detail = data["__DEFAULT_SCOPE__"]["webapp.user-detail"]
    user_info = detail["userInfo"]
    user = user_info["user"]
    stats = user_info.get("stats") or {}

    return {
        "username": user.get("uniqueId") or username,
        "nickname": user.get("nickname") or username,
        "avatar": user.get("avatarMedium") or user.get("avatarThumb") or "",
        "bio": user.get("signature") or "",
        "profileUrl": url,
        "followers": parse_int(stats.get("followerCount")),
        "following": parse_int(stats.get("followingCount")),
        "likes": parse_int(stats.get("heartCount") or stats.get("heart")),
        "videos": parse_int(stats.get("videoCount")),
    }


def fetch_video_totals(username):
    if YoutubeDL is None:
        raise RuntimeError(f"yt-dlp is not available: {YTDLP_IMPORT_ERROR}")

    options = {
        "extract_flat": True,
        "ignoreerrors": True,
        "no_warnings": True,
        "playlistend": PLAYLIST_LIMIT,
        "quiet": True,
        "skip_download": True,
        "socket_timeout": 20,
    }

    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(f"https://www.tiktok.com/@{username}", download=False)

    entries = [entry for entry in info.get("entries", []) if entry]

    def total(field):
        return sum(parse_int(entry.get(field)) for entry in entries)

    latest = []
    comment_sources = []

    for entry in entries[:COMMENT_VIDEO_LIMIT]:
        video_id = entry.get("id") or ""
        video_url = entry.get("url") or entry.get("webpage_url")
        if not video_url and video_id:
            video_url = f"https://www.tiktok.com/@{username}/video/{video_id}"

        if video_url:
            comment_sources.append(
                {
                    "id": video_id,
                    "title": entry.get("title") or "",
                    "url": video_url,
                }
            )

    for entry in entries[:3]:
        latest.append(
            {
                "id": entry.get("id"),
                "title": entry.get("title") or "",
                "url": entry.get("url") or entry.get("webpage_url") or "",
                "views": parse_int(entry.get("view_count")),
                "likes": parse_int(entry.get("like_count")),
            }
        )

    return {
        "videosSeen": len(entries),
        "views": total("view_count"),
        "likes": total("like_count"),
        "comments": total("comment_count"),
        "shares": total("repost_count"),
        "saves": total("save_count"),
        "latest": latest,
        "commentSources": comment_sources,
    }


def normalize_comment(comment, video):
    user = comment.get("user") or {}
    created_at = parse_int(comment.get("create_time"))
    text = (comment.get("text") or "").strip()
    if not text:
        text = "Комментарий с изображением" if comment.get("images") else "Комментарий без текста"

    return {
        "id": str(comment.get("id") or ""),
        "text": text,
        "author": user.get("nickname") or user.get("unique_id") or "TikTok user",
        "handle": user.get("unique_id") or "",
        "avatar": user.get("avatar") or "",
        "likes": parse_int(comment.get("digg_count")),
        "replies": parse_int(comment.get("reply_total")),
        "createdAt": datetime.fromtimestamp(created_at, timezone.utc).isoformat() if created_at else "",
        "videoId": video.get("id") or comment.get("video_id") or "",
        "videoTitle": video.get("title") or "",
        "videoUrl": video.get("url") or "",
    }


def fetch_video_comments(video):
    api_url = (
        "https://www.tikwm.com/api/comment/list?url="
        f"{quote(video['url'], safe='')}&count=10&cursor=0"
    )

    for attempt in range(2):
        request = Request(
            api_url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )

        with urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8", "replace"))

        if data.get("code") == 0:
            return [
                normalize_comment(comment, video)
                for comment in (data.get("data") or {}).get("comments", [])
            ]

        if "limit" in str(data.get("msg", "")).lower() and attempt == 0:
            time.sleep(COMMENT_REQUEST_DELAY_SECONDS)
            continue

        return []

    return []


def fetch_latest_comments(video_sources):
    comments = []
    seen = set()

    for index, video in enumerate(video_sources):
        if index:
            time.sleep(COMMENT_REQUEST_DELAY_SECONDS)

        try:
            video_comments = fetch_video_comments(video)
        except (HTTPError, URLError, RuntimeError, ValueError, TimeoutError) as exc:
            print(f"Comment fetch failed for {video.get('id')}: {exc}")
            continue

        for comment in video_comments:
            comment_id = comment["id"]
            if comment_id and comment_id not in seen:
                comments.append(comment)
                seen.add(comment_id)

        comments.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
        if len(comments) >= 5:
            break

    comments.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
    return comments[:5]


def store_comments(items):
    with comments_cache_lock:
        comments_cache["items"] = items
        comments_cache["fetched_at"] = time.time()
    return items


def refresh_comments_cache(video_sources):
    try:
        store_comments(fetch_latest_comments(video_sources))
    finally:
        comments_refresh_lock.release()


def get_latest_comments(video_sources):
    now = time.time()
    with comments_cache_lock:
        cached = list(comments_cache["items"])
        fetched_at = comments_cache["fetched_at"]
        if cached and now - fetched_at < COMMENTS_TTL_SECONDS:
            return cached

    if cached:
        if comments_refresh_lock.acquire(blocking=False):
            thread = threading.Thread(
                target=refresh_comments_cache,
                args=(video_sources,),
                daemon=True,
            )
            thread.start()
        return cached

    comments_refresh_lock.acquire()
    try:
        with comments_cache_lock:
            cached = list(comments_cache["items"])
            fetched_at = comments_cache["fetched_at"]
            if cached and time.time() - fetched_at < COMMENTS_TTL_SECONDS:
                return cached
        return store_comments(fetch_latest_comments(video_sources))
    finally:
        comments_refresh_lock.release()


def create_payload():
    profile = fetch_profile(USERNAME)
    videos = fetch_video_totals(USERNAME)
    latest_comments = get_latest_comments(videos["commentSources"])

    all_videos_seen = videos["videosSeen"] >= profile["videos"]
    likes = videos["likes"] if all_videos_seen and videos["likes"] else profile["likes"]
    engagement_rate = (
        ((likes + videos["comments"] + videos["shares"]) / videos["views"]) * 100
        if videos["views"]
        else 0
    )

    return {
        "ok": True,
        "account": {
            "username": profile["username"],
            "nickname": profile["nickname"],
            "avatar": profile["avatar"],
            "bio": profile["bio"],
            "profileUrl": profile["profileUrl"],
        },
        "stats": {
            "likes": likes,
            "views": videos["views"],
            "comments": videos["comments"],
            "shares": videos["shares"],
            "followers": profile["followers"],
            "following": profile["following"],
            "videos": profile["videos"],
            "saves": videos["saves"],
            "er": round(engagement_rate, 2),
        },
        "coverage": {
            "videosSeen": videos["videosSeen"],
            "videosTotal": profile["videos"],
            "complete": all_videos_seen,
        },
        "latest": videos["latest"],
        "comments": latest_comments,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "cacheAgeSeconds": 0,
        "refreshing": False,
    }


def store_payload(payload):
    with cache_lock:
        cache["payload"] = payload
        cache["fetched_at"] = time.time()

    return payload


def cached_response(cached, fetched_at, refreshing=False, stale=False, error=None):
    payload = dict(cached)
    payload["cacheAgeSeconds"] = round(time.time() - fetched_at)
    payload["refreshing"] = refreshing
    if stale:
        payload["stale"] = True
    if error:
        payload["error"] = str(error)
    return payload


def refresh_cache_in_background():
    try:
        store_payload(create_payload())
    except (HTTPError, URLError, RuntimeError, KeyError, ValueError) as exc:
        print(f"Background refresh failed: {exc}")
    finally:
        refresh_lock.release()


def build_payload(force=False):
    now = time.time()
    with cache_lock:
        cached = cache["payload"]
        fetched_at = cache["fetched_at"]
        if cached and not force and now - fetched_at < CACHE_TTL_SECONDS:
            return cached_response(cached, fetched_at, refreshing=False)

    if cached and not force:
        if refresh_lock.acquire(blocking=False):
            thread = threading.Thread(target=refresh_cache_in_background, daemon=True)
            thread.start()
        return cached_response(cached, fetched_at, refreshing=True)

    refresh_lock.acquire()
    try:
        now = time.time()
        with cache_lock:
            cached = cache["payload"]
            fetched_at = cache["fetched_at"]
            if cached and not force and now - fetched_at < CACHE_TTL_SECONDS:
                return cached_response(cached, fetched_at, refreshing=False)

        return store_payload(create_payload())
    except (HTTPError, URLError, RuntimeError, KeyError, ValueError) as exc:
        with cache_lock:
            cached = cache["payload"]
            fetched_at = cache["fetched_at"]
        if cached:
            return cached_response(cached, fetched_at, stale=True, error=exc)
        raise RuntimeError(f"Could not fetch TikTok stats: {exc}") from exc
    finally:
        refresh_lock.release()


class StatsHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {format % args}")

    def do_GET(self):
        route_path = urlsplit(self.path).path
        if route_path.startswith("/api/stats"):
            self.send_stats()
            return
        if route_path == "/":
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", STATS_PATH)
            self.end_headers()
            return
        if route_path == LEGACY_GOAL_PATH:
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", GOAL_PATH)
            self.end_headers()
            return
        if route_path == STATS_PATH:
            self.path = "/stats.html"
        elif route_path == GOAL_PATH:
            self.path = "/teamg.html"
        elif route_path == TERMINAL_PATH:
            self.path = "/terminal.html"
        super().do_GET()

    def send_stats(self):
        try:
            force = "force=1" in self.path
            payload = build_payload(force=force)
            status = HTTPStatus.OK
        except RuntimeError as exc:
            payload = {"ok": False, "error": str(exc)}
            status = HTTPStatus.BAD_GATEWAY

        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8787))
    server = ThreadingHTTPServer((host, port), StatsHandler)
    shown_host = "127.0.0.1" if host == "0.0.0.0" else host
    print(f"{APP_NAME} is running at http://{shown_host}:{port}{STATS_PATH}")
    print(f"mg sound is running at http://{shown_host}:{port}{GOAL_PATH}")
    print(f"MGS transmission terminal is running at http://{shown_host}:{port}{TERMINAL_PATH}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
