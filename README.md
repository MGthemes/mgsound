# MG Sound Statistics

Three small TikTok dashboards for `@mg_sound1`.

## Local Run

```powershell
& "C:\Users\drmgr\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" server.py
```

Open the statistics dashboard:

```text
http://127.0.0.1:8787/mg-sound-statistics
```

Open the follower-goal CRT dashboard:

```text
http://127.0.0.1:8787/mg-sound
```

Open the fullscreen transmission terminal:

```text
http://127.0.0.1:8787/transmission-terminal
```

Quick terminal config via URL:

```text
http://127.0.0.1:8787/transmission-terminal?archive=024&listeners=293&goal=1000&live=0&users=@night_signal,@lost_archive
```

Use `live=0` to keep the manual listener count. Leave it out to pull followers from `/api/stats`.

## Deploy

The app needs a Python server because the browser UI calls `/api/stats`, and the server collects TikTok stats with `yt-dlp`.

Ready-to-use deployment files:

- `requirements.txt`
- `Procfile`
- `render.yaml`
- `Dockerfile`

For Render, create a new Blueprint/Web Service from this repo. The service should run:

```sh
pip install -r requirements.txt
HOST=0.0.0.0 python server.py
```

Render, Railway, Fly, and Docker hosts should provide `PORT` automatically. The app reads `PORT` from the environment.
