import path from 'node:path';
import { config } from './config.js';
import { run } from './proc.js';
import { UserFacingError } from './ytdlp.js';

async function probe(file, signal) {
  const { stdout } = await run(
    config.ffprobePath,
    ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,pix_fmt', '-of', 'json', file],
    { timeoutMs: 30_000, signal },
  );
  const streams = JSON.parse(stdout).streams || [];
  return {
    video: streams.find((s) => s.codec_type === 'video'),
    audio: streams.find((s) => s.codec_type === 'audio'),
  };
}

/**
 * iOS Photos only imports H.264/HEVC + AAC in MP4/MOV; we target H.264 unless ALLOW_HEVC=1. yt-dlp prefers h264/aac but falls back to
 * VP9/AV1/Opus when that's all a site offers, so check and re-encode only what's actually wrong.
 * Always rewrite with +faststart so the moov atom is at the front.
 */
export async function ensureIosCompatible(file, dir, signal) {
  let streams;
  try {
    streams = await probe(file, signal);
  } catch (e) {
    throw new UserFacingError(502, 'Could not read the downloaded file.');
  }
  const v = streams.video;
  const a = streams.audio;
  const videoOk = !v || ((v.codec_name === 'h264' || (config.allowHevc && v.codec_name === 'hevc')) && (!v.pix_fmt || v.pix_fmt === 'yuv420p' || v.pix_fmt === 'yuvj420p'));
  const audioOk = !a || a.codec_name === 'aac';

  const out = path.join(dir, 'out.mp4');
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-map', '0:v:0?', '-map', '0:a:0?'];
  args.push(...(videoOk ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high']));
  args.push(...(audioOk ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '160k']));
  // HEVC needs the hvc1 tag or QuickTime/Photos refuses it.
  if (videoOk && v?.codec_name === 'hevc') args.push('-tag:v', 'hvc1');
  args.push('-movflags', '+faststart', out);

  try {
    // Re-encodes can be slow on long videos; reuse the download timeout budget.
    await run(config.ffmpegPath, args, { timeoutMs: config.downloadTimeoutMs, signal });
  } catch (e) {
    throw new UserFacingError(500, 'Converting the video for iPhone failed.');
  }
  if (!videoOk || !audioOk) console.log(`[transcode] ${v?.codec_name}/${a?.codec_name} -> h264/aac`);
  return out;
}
