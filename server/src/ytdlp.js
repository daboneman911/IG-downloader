import { config } from './config.js';
import { run, ProcError } from './proc.js';

// Flags shared by every yt-dlp call. No cookies are ever passed: we only serve public content
// and deliberately don't bypass login walls.
const BASE_ARGS = ['--no-warnings', '--no-progress', '--ignore-config', '--socket-timeout', '20'];

const QUALITY_TARGETS = [1080, 720, 480];

export class UserFacingError extends Error {
  constructor(status, message, stderr) {
    super(message);
    this.status = status;
    // Raw extractor output, kept for server logs only.
    this.stderr = stderr;
  }
}

/** Translate yt-dlp stderr into something a user can act on; never leak raw stderr to clients. */
export function explainYtdlpError(e) {
  if (e instanceof UserFacingError) return e;
  const raw = e.stderr || e.message || '';
  const s = raw.toLowerCase();
  const fail = (status, msg) => new UserFacingError(status, msg, raw.trim());
  if (e.timedOut) return fail(504, 'The site took too long to respond. Try again.');
  if (/private|login required|log in|sign in to confirm|cookies|requires authentication|restricted/.test(s))
    return fail(403, 'This content is private or behind a login, which is not supported.');
  if (/not available|unavailable|removed|does not exist|404|no video formats|no video could be found|there is no video/.test(s))
    return fail(404, 'Nothing downloadable was found at that link.');
  if (/ip address is blocked|geo.?restrict|not available in your country/.test(s))
    return fail(451, 'This content is region-blocked for our server.');
  if (/unsupported url/.test(s)) return fail(400, 'That link format is not supported.');
  if (/max-filesize|larger than max/.test(s)) return fail(413, 'That file is too large.');
  if (/429|too many requests|rate.?limit/.test(s))
    return fail(503, 'The site is rate-limiting us right now. Try again in a few minutes.');
  return fail(502, 'Could not fetch that link. The site may have changed; try again later.');
}

export async function ytdlpVersion() {
  try {
    const { stdout } = await run(config.ytdlpPath, ['--version'], { timeoutMs: 10_000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

function shortSide(f) {
  if (!f.width || !f.height) return f.height || 0;
  return Math.min(f.width, f.height);
}

// Extractors that don't report codecs (Facebook progressive "sd"/"hd") still report video_ext.
const hasVideo = (f) => (f.vcodec ? f.vcodec !== 'none' : f.video_ext ? f.video_ext !== 'none' : !f.acodec || f.acodec === 'none');
const hasAudio = (f) => f.acodec && f.acodec !== 'none';
const isImageEntry = (e) => !e.formats?.some(hasVideo) && /\.(jpe?g|png|webp|heic)(\?|$)/i.test(e.url || '');

function pickThumb(e) {
  if (e.thumbnail) return e.thumbnail;
  const t = (e.thumbnails || []).filter((x) => x.url);
  return t.length ? t[t.length - 1].url : null;
}

/** Build the 1080/720/480/MP3 menu from what the source actually offers. */
function buildOptions(e) {
  if (isImageEntry(e)) return [{ format: 'image', label: 'Photo', ext: (e.ext || 'jpg').replace('jpeg', 'jpg') }];

  const formats = e.formats?.length ? e.formats : [e];
  const video = formats.filter(hasVideo);
  // Some extractors (e.g. a few TikTok/FB variants) omit codec info; treat unknown as "has both".
  const anyAudio = formats.some((f) => hasAudio(f) || f.acodec === undefined);
  const maxShort = Math.max(0, ...video.map(shortSide), shortSide(e));

  const opts = [];
  for (const t of QUALITY_TARGETS) {
    // Allow ~10% slack: a 1024x576 TikTok is "really" 576p but sources like 1080x1920 report exactly 1080.
    if (maxShort >= t * 0.9) opts.push({ format: String(t), label: `${t}p`, ext: 'mp4' });
  }
  // Off-ladder sources (640x640 IG, 240p old YouTube, FB with no dimensions) get their real top
  // resolution as the first option rather than being mislabelled as the next rung down.
  const onLadder = QUALITY_TARGETS.some((t) => maxShort >= t * 0.9 && maxShort <= t * 1.1);
  if ((video.length || maxShort) && !onLadder && !(maxShort > 1080 * 1.1))
    opts.unshift({ format: 'best', label: maxShort ? `${maxShort}p` : 'Best quality', ext: 'mp4' });
  if (anyAudio) opts.push({ format: 'mp3', label: 'Audio (MP3)', ext: 'mp3' });
  return opts;
}

function normalizeEntry(e, index) {
  return {
    index,
    kind: isImageEntry(e) ? 'image' : 'video',
    title: e.title || null,
    thumbnail: pickThumb(e),
    duration: e.duration ? Math.round(e.duration) : null,
    options: buildOptions(e),
    // Kept server-side only (stripped before responding): direct image URL for photo items.
    _imageUrl: isImageEntry(e) ? e.url : null,
  };
}

export async function fetchInfo(url, platform, signal) {
  const args = [...BASE_ARGS, '-J'];
  // YouTube "watch?v=..&list=.." links would otherwise pull a whole playlist. Instagram carousels
  // and some FB posts ARE playlists, so for those we keep entries but cap how many.
  if (platform === 'youtube') args.push('--no-playlist');
  else args.push('--playlist-items', '1:20');
  args.push('--', url);

  let json;
  try {
    const { stdout } = await run(config.ytdlpPath, args, { timeoutMs: config.infoTimeoutMs, signal });
    json = JSON.parse(stdout);
  } catch (e) {
    if (e instanceof SyntaxError) throw new UserFacingError(502, 'Unexpected response from extractor.');
    throw explainYtdlpError(e);
  }

  const rawEntries = json._type === 'playlist' ? (json.entries || []).filter(Boolean) : [json];
  if (!rawEntries.length) throw new UserFacingError(404, 'Nothing downloadable was found at that link.');
  const items = rawEntries.map((e, i) => normalizeEntry(e, i + 1)).filter((it) => it.options.length);
  if (!items.length) throw new UserFacingError(404, 'Nothing downloadable was found at that link.');

  const first = rawEntries[0];
  return {
    platform,
    url,
    title: json.title || first.title || json.description?.slice(0, 80) || 'Untitled',
    author: json.uploader || json.channel || first.uploader || first.channel || json.uploader_id || null,
    thumbnail: pickThumb(json) || items[0].thumbnail,
    duration: items.length === 1 ? items[0].duration : null,
    items,
  };
}

/**
 * yt-dlp format selection for a quality target. -S sorts rather than filters, so a 720 request on a
 * 480-only source still succeeds; h264/aac/mp4 are preferred so most downloads need no re-encode.
 */
export function formatArgs(format) {
  const prefer = 'vcodec:h264,acodec:aac,ext:mp4:m4a';
  if (format === 'mp3') return ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '192K'];
  if (format === 'best') return ['-f', 'bv*+ba/b', '-S', `res,${prefer}`];
  return ['-f', 'bv*+ba/b', '-S', `res:${format},${prefer}`];
}

export async function downloadToDir({ url, platform, itemIndex, format, dir, signal }) {
  const args = [
    ...BASE_ARGS,
    '--ffmpeg-location', config.ffmpegPath,
    '--max-filesize', config.maxFilesize,
    '--no-part',
    '--restrict-filenames',
    '-o', `${dir}/src.%(ext)s`,
    ...formatArgs(format),
  ];
  if (platform === 'youtube') args.push('--no-playlist');
  else args.push('--playlist-items', String(itemIndex));
  // Merge into mp4 when the chosen streams allow it; transcode.js handles the codec fix-up.
  if (format !== 'mp3') args.push('--merge-output-format', 'mp4');
  args.push('--', url);
  try {
    await run(config.ytdlpPath, args, { timeoutMs: config.downloadTimeoutMs, signal });
  } catch (e) {
    throw explainYtdlpError(e);
  }
}

export { ProcError };
