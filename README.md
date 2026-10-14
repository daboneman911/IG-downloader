# GrabDL: IG downloader

A mobile-first video downloader PWA for **YouTube** (videos and Shorts), **Instagram** (Reels, posts, carousels), **Facebook** (videos, Reels) and **TikTok**. It's built for iPhone Safari: you paste a link, pick a quality, tap Download, then tap **Save to Photos** to open the iOS share sheet and save the video to the Camera Roll.

```
/server   Node 22 + Express: wraps yt-dlp (extraction) and ffmpeg (merge, H.264/AAC, MP3)
/web      React + Vite + TypeScript + Tailwind v4, installable PWA
docker-compose.yml   runs both with one command
```

> **Legal:** this is for downloading content you own or have permission to use. Private, login-only and paywalled content is not supported. The server never passes cookies to yt-dlp, so it doesn't get past login walls. Respect creators and each platform's terms.

---

## Run it

### Option A: Docker (one command)

```bash
docker compose up --build
# open http://localhost:8080
```

nginx serves the web build and proxies `/api` to the server, with response buffering off so downloads stream straight through.

### Option B: Local dev (no Docker)

Requirements: Node 20+, plus **yt-dlp**, **ffmpeg** and **Deno** (yt-dlp needs Deno for YouTube). None of them need admin rights:

| OS | Install |
|---|---|
| Windows | `winget install --scope user yt-dlp.yt-dlp Gyan.FFmpeg` (installs Deno as a dependency) |
| macOS | `brew install yt-dlp ffmpeg deno` |
| Linux | download `yt-dlp_linux` from the releases page, then `apt install ffmpeg` and install Deno |

```bash
npm install                       # installs both workspaces
cp server/.env.example server/.env   # set YTDLP_PATH / FFMPEG_PATH if they aren't on PATH
npm run dev                       # server on :8787, web on :5173 (/api is proxied)
```

To test on a real iPhone, put it on the same Wi-Fi and open `http://<your-PC-LAN-IP>:5173`. **Save to Photos needs HTTPS** (the Web Share API only works in a secure context), so for the full flow use a tunnel such as `cloudflared tunnel --url http://localhost:5173` or `ngrok http 5173`, or deploy.

---

## API

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/info` `{ "url": "…" }` | Returns `{ id, platform, title, author, thumbnail, duration, items[] }`. Each item has `options[]` (`1080` / `720` / `480` / `best` / `mp3` / `image`). Only the 4 supported domains are accepted, matched on the parsed hostname. |
| `GET` | `/api/download?id=&format=&item=` | Streams the file from disk with `Content-Type`, `Content-Length` and RFC 6266 `Content-Disposition`. It never buffers the whole file in memory. |
| `GET` | `/api/thumb?id=&item=` | Thumbnail proxy (IG/FB CDNs block cross-site embedding). It only serves URLs that `/api/info` already resolved, so it isn't an open proxy. |
| `GET` | `/api/health` | `{ ok, ytdlp: "2026.08.19", node, uptime }` |

**What the server does to keep this safe and stable:**
- **Rate limits per IP:** info 20/min, download 8/min. Set `TRUST_PROXY=1` behind a proxy so it sees the real client IP.
- **Concurrency cap:** `MAX_CONCURRENT_JOBS`, default 3. Extra requests get `503` with `Retry-After`.
- **Timeouts:** info 45s, download plus conversion 10 min. A request that's abandoned kills its yt-dlp/ffmpeg process.
- **Temp files:** each job gets its own temp dir, deleted after streaming. A sweeper also removes anything older than 1 hour.
- **Errors:** yt-dlp's stderr is translated into short messages for users (private/login, region-blocked, rate-limited, not found). The raw stderr goes only to the server log.

**iOS compatibility:** yt-dlp's format sort prefers H.264, AAC and MP4. After download, `ffprobe` checks the codecs. VP9, AV1, HEVC, Opus or non-yuv420p sources get re-encoded with libx264/AAC; everything else is just remuxed. Every MP4 gets `+faststart`. Set `ALLOW_HEVC=1` to pass HEVC through instead, which saves CPU (iOS Photos plays HEVC too).

### Keeping yt-dlp current

Sites break yt-dlp often. There are three ways to update it:
- `YTDLP_UPDATE_HOURS=24` (the default in Docker) runs `yt-dlp -U` on boot and then once a day.
- `npm run update-ytdlp` updates it once, by hand.
- Rebuilding the Docker image always pulls the latest release.

`/api/health` reports the version that's running.

### Server env vars

See `server/.env.example`. The main ones are `PORT`, `YTDLP_PATH`, `FFMPEG_PATH`, `CORS_ORIGIN`, `TRUST_PROXY`, `YTDLP_UPDATE_HOURS`, `MAX_CONCURRENT_JOBS`, `MAX_FILESIZE` (default `1500M`) and `ALLOW_HEVC`.

---

## Deploy

**Server on Railway**
1. New project → Deploy from GitHub repo → set **Root Directory** to `server`. Railway detects the Dockerfile.
2. Variables: `TRUST_PROXY=1`, and `CORS_ORIGIN=https://<your-vercel-app>.vercel.app`.
3. Generate a domain and check that `https://<domain>/api/health` responds.

**Server on Fly.io**
```bash
cd server
fly launch --no-deploy --copy-config   # edit the app name in fly.toml first
fly secrets set CORS_ORIGIN=https://<your-vercel-app>.vercel.app
fly deploy
```
Temp files go to the machine's ephemeral disk. Give it at least 1 GB of RAM if you expect re-encodes.

**Web on Vercel**
1. Import the repo → set **Root Directory** to `web` (the framework preset is Vite).
2. Env var: `VITE_API_BASE=https://<your-server-domain>`.
3. Deploy. `web/vercel.json` handles the SPA rewrite and sets no-cache on the service worker.

> A video host is CPU- and bandwidth-heavy, so check your provider's terms and egress pricing. YouTube in particular often blocks datacenter IPs. If `/api/info` starts returning "rate-limiting" or "sign in to confirm" errors on YouTube, that's the server's IP being blocked, not a bug.

---

## iPhone Safari test checklist

Run these on a real iPhone over **HTTPS** (a deployed URL or a tunnel):

- [ ] **Layout at 375 and 430 widths** (iPhone SE/mini and Pro Max): nothing scrolls sideways, and the Download bar sits above the home indicator rather than behind it.
- [ ] **Paste button:** with a link copied in Instagram/TikTok, tap **Paste**. iOS shows its "Paste" callout; tapping it starts the preview automatically.
- [ ] **Paste via long-press** into the box: the preview starts without tapping Download, and the keyboard closes.
- [ ] Tapping the input **doesn't zoom** the page.
- [ ] **One URL per platform** shows a preview with thumbnail, title and author:
  - [ ] YouTube video
  - [ ] YouTube Short
  - [ ] Instagram Reel
  - [ ] Instagram carousel: the item picker shows each item, and switching item updates the quality list
  - [ ] Facebook video or Reel
  - [ ] TikTok
- [ ] **Download 720p** → the progress bar runs → **Save to Photos** → the share sheet shows **Save Video** → the video plays in Photos **with sound**.
- [ ] **Audio (MP3)** → the share sheet offers **Save to Files**, and the file plays.
- [ ] **Save to Files** fallback → the file appears in Files › Downloads.
- [ ] **Cancel** mid-download (tap the progress bar): it returns to the quality screen with no error.
- [ ] **Errors:** a private or login-only post shows the private/login message; a random non-video site shows the "Paste a YouTube…" message.
- [ ] **Dark mode** (Settings › Display › Dark): the colours swap and the text stays readable.
- [ ] **Install the PWA:** Share › **Add to Home Screen**. The icon is the gradient download arrow; it opens full-screen with no Safari bars, and the header clears the Dynamic Island.
- [ ] **Offline shell:** after one visit, turn on Airplane Mode and reopen the home-screen app. The UI loads, and fetching shows a "can't reach server" error rather than a blank page.
- [ ] **Rotate to landscape:** content stays within the safe areas.
