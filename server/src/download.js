import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from './config.js';
import { downloadToDir, UserFacingError } from './ytdlp.js';
import { ensureIosCompatible } from './transcode.js';
import * as store from './store.js';

let activeJobs = 0;

const MIME = { mp4: 'video/mp4', mp3: 'audio/mpeg', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

/** RFC 6266 filename: ASCII fallback for old clients + UTF-8 filename* for everything else. */
function contentDisposition(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function safeBaseName(info, item) {
  const base = (info.title || 'video')
    .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'video';
  return info.items.length > 1 ? `${base} (${item.index})` : base;
}

/** Remove job dirs left behind by crashes or killed requests. */
export async function sweepTmp(maxAgeMs = 60 * 60_000) {
  await fsp.mkdir(config.tmpRoot, { recursive: true });
  const now = Date.now();
  for (const name of await fsp.readdir(config.tmpRoot)) {
    const p = path.join(config.tmpRoot, name);
    try {
      const st = await fsp.stat(p);
      if (now - st.mtimeMs > maxAgeMs) await fsp.rm(p, { recursive: true, force: true });
    } catch {
      /* raced with another cleanup */
    }
  }
}

async function findOutput(dir, ext) {
  const files = await fsp.readdir(dir);
  const hit = files.find((f) => f.endsWith('.' + ext)) || files.find((f) => f.startsWith('src.'));
  return hit ? path.join(dir, hit) : null;
}

/** Proxy only thumbnails that /api/info already resolved; this is not an open proxy. */
export async function handleThumb(req, res) {
  const info = typeof req.query.id === 'string' ? store.get(req.query.id) : null;
  const n = Number.parseInt(req.query.item ?? '0', 10);
  const src = !info ? null : n === 0 ? info.thumbnail : info.items.find((it) => it.index === n)?.thumbnail;
  if (!src) return res.status(404).end();
  try {
    const upstream = await fetch(src, { signal: AbortSignal.timeout(15_000) });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !upstream.body || !type.startsWith('image/')) throw new Error(`upstream ${upstream.status} ${type}`);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=1800');
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (e) {
    console.warn('[thumb]', e.message);
    if (!res.headersSent) res.status(502).end();
  }
}

export async function handleDownload(req, res) {
  const { id, format } = req.query;
  const itemIndex = Number.parseInt(req.query.item ?? '1', 10);
  const info = typeof id === 'string' ? store.get(id) : null;
  if (!info) return res.status(404).json({ error: 'This link expired. Paste it again.' });
  const item = info.items.find((it) => it.index === itemIndex);
  const option = item?.options.find((o) => o.format === format);
  if (!item || !option) return res.status(400).json({ error: 'Unknown item or format.' });

  const filename = `${safeBaseName(info, item)}.${option.ext}`;

  // Photos: proxy the CDN image straight through; nothing to convert.
  if (option.format === 'image') {
    try {
      const upstream = await fetch(item._imageUrl, { signal: AbortSignal.timeout(30_000) });
      if (!upstream.ok || !upstream.body) throw new Error(`upstream ${upstream.status}`);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || MIME[option.ext] || 'application/octet-stream');
      const len = upstream.headers.get('content-length');
      if (len) res.setHeader('Content-Length', len);
      res.setHeader('Content-Disposition', contentDisposition(filename));
      await pipeline(Readable.fromWeb(upstream.body), res);
    } catch (e) {
      console.warn('[download:image]', e.message);
      if (!res.headersSent) res.status(502).json({ error: 'Could not fetch that photo.' });
    }
    return;
  }

  // Each job runs yt-dlp + possibly an ffmpeg transcode; cap them so a few users can't pin the CPU.
  if (activeJobs >= config.maxConcurrentJobs) {
    res.setHeader('Retry-After', '15');
    return res.status(503).json({ error: 'Server is busy. Try again in a few seconds.' });
  }
  activeJobs++;

  const ac = new AbortController();
  res.on('close', () => ac.abort());
  await fsp.mkdir(config.tmpRoot, { recursive: true });
  const dir = await fsp.mkdtemp(path.join(config.tmpRoot, 'job-'));
  const cleanup = () => fsp.rm(dir, { recursive: true, force: true }).catch(() => {});

  try {
    await downloadToDir({ url: info.url, platform: info.platform, itemIndex, format, dir, signal: ac.signal });
    let file = await findOutput(dir, option.ext);
    if (!file) throw new UserFacingError(502, 'Download produced no file.');
    if (option.ext === 'mp4') file = await ensureIosCompatible(file, dir, ac.signal);

    const { size } = await fsp.stat(file);
    res.setHeader('Content-Type', MIME[option.ext]);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('Cache-Control', 'no-store');
    // Stream from disk; the file is never held in memory.
    await pipeline(fs.createReadStream(file), res);
  } catch (e) {
    if (ac.signal.aborted) return; // client went away; nothing to report
    const err = e instanceof UserFacingError ? e : new UserFacingError(500, 'Something went wrong.');
    console.warn(`[download] ${info.platform} ${format}: ${e.stderr || e.message}`);
    if (!res.headersSent) res.status(err.status).json({ error: err.message });
    else res.destroy();
  } finally {
    activeJobs--;
    await cleanup();
  }
}
