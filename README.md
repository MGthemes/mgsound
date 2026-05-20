# MG Sound Statistics

Two small TikTok dashboards for `@mg_sound1`.

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
