import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { detectPlatform } from './platforms.js';
import { fetchInfo, ytdlpVersion, UserFacingError } from './ytdlp.js';
import { handleDownload, handleThumb, sweepTmp } from './download.js';
import { scheduleUpdates } from './update.js';
import * as store from './store.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(express.json({ limit: '4kb' }));
if (config.corsOrigins.length) {
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ['Content-Disposition', 'Content-Length'] }));
}

const limiter = (perMin) =>
  rateLimit({
    windowMs: 60_000,
    limit: perMin,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Slow down and try again in a minute.' },
  });

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, ytdlp: await ytdlpVersion(), node: process.version, uptime: Math.round(process.uptime()) });
});

app.post('/api/info', limiter(config.infoRatePerMin), async (req, res) => {
  const detected = detectPlatform(req.body?.url);
  if (!detected) {
    return res.status(400).json({ error: 'Paste a YouTube, Instagram, Facebook or TikTok link.' });
  }
  // Abort yt-dlp if the client gives up, so abandoned requests don't keep burning CPU.
  const ac = new AbortController();
  res.on('close', () => ac.abort());
  try {
    const info = await fetchInfo(detected.url, detected.platform, ac.signal);
    const id = store.put(info, config.infoTtlMs);
    // Thumbnails go through /api/thumb: IG/FB CDNs block cross-site embedding and their URLs expire.
    const thumb = (n) => `/api/thumb?id=${id}&item=${n}`;
    res.json({
      id,
      platform: info.platform,
      title: info.title,
      author: info.author,
      thumbnail: info.thumbnail ? thumb(0) : null,
      duration: info.duration,
      items: info.items.map(({ _imageUrl, ...pub }) => ({ ...pub, thumbnail: pub.thumbnail ? thumb(pub.index) : null })),
    });
  } catch (e) {
    if (ac.signal.aborted) return; // client navigated away; yt-dlp was killed on purpose
    const err = e instanceof UserFacingError ? e : new UserFacingError(500, 'Something went wrong.');
    if (!(e instanceof UserFacingError)) console.error('[info]', e);
    else console.warn(`[info] ${detected.platform} ${err.status}: ${e.stderr || err.message}`);
    if (!res.headersSent) res.status(err.status).json({ error: err.message });
  }
});

app.get('/api/download', limiter(config.downloadRatePerMin), handleDownload);
app.get('/api/thumb', limiter(120), handleThumb);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  if (!res.headersSent) res.status(err.status || 500).json({ error: 'Something went wrong.' });
});

await sweepTmp();
setInterval(sweepTmp, 15 * 60_000).unref();
scheduleUpdates();

app.listen(config.port, async () => {
  console.log(`server listening on :${config.port} (yt-dlp ${(await ytdlpVersion()) ?? 'NOT FOUND'})`);
});
