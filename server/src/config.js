import os from 'node:os';
import path from 'node:path';

const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));

export const config = {
  port: int(process.env.PORT, 8787),
  ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  // ffprobe normally sits next to ffmpeg; derive it so only one path needs configuring.
  ffprobePath:
    process.env.FFPROBE_PATH ||
    (process.env.FFMPEG_PATH
      ? path.join(path.dirname(process.env.FFMPEG_PATH), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
      : 'ffprobe'),
  tmpRoot: process.env.TMP_DIR || path.join(os.tmpdir(), 'igdl'),
  // Comma-separated list of allowed browser origins; empty = same-origin only (docker/nginx setup).
  corsOrigins: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  // Number of reverse proxies in front of us (Railway/Fly/nginx = 1) so rate limiting sees the real client IP.
  trustProxy: int(process.env.TRUST_PROXY, 0),
  infoTimeoutMs: int(process.env.INFO_TIMEOUT_MS, 45_000),
  downloadTimeoutMs: int(process.env.DOWNLOAD_TIMEOUT_MS, 10 * 60_000),
  maxConcurrentJobs: int(process.env.MAX_CONCURRENT_JOBS, 3),
  maxFilesize: process.env.MAX_FILESIZE || '1500M',
  infoRatePerMin: int(process.env.INFO_RATE_PER_MIN, 20),
  downloadRatePerMin: int(process.env.DOWNLOAD_RATE_PER_MIN, 8),
  // How long a /api/info result stays downloadable via its id.
  infoTtlMs: int(process.env.INFO_TTL_MS, 30 * 60_000),
  // iOS Photos plays HEVC, but other apps/older devices may not; default to strict H.264 output.
  allowHevc: process.env.ALLOW_HEVC === '1',
  // Self-update the yt-dlp binary on boot and every N hours (0 = never). Sites break yt-dlp often.
  ytdlpUpdateHours: int(process.env.YTDLP_UPDATE_HOURS, 0),
};
