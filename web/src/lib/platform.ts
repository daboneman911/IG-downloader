import type { Platform } from './api';

// Mirrors server/src/platforms.js. The server is the authority; this only drives the UI hint/tabs.
const DOMAINS: Record<Platform, string[]> = {
  youtube: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
  instagram: ['instagram.com', 'instagr.am'],
  facebook: ['facebook.com', 'fb.watch', 'fb.com'],
  tiktok: ['tiktok.com'],
};

export const PLATFORMS: { id: Platform; name: string; hint: string }[] = [
  { id: 'instagram', name: 'Instagram', hint: 'Reels, posts & carousels' },
  { id: 'tiktok', name: 'TikTok', hint: 'Videos' },
  { id: 'youtube', name: 'YouTube', hint: 'Videos & Shorts' },
  { id: 'facebook', name: 'Facebook', hint: 'Videos & Reels' },
];

/** Pull the first URL out of pasted text ("Check this out https://…" from share sheets). */
export function extractUrl(text: string): string {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text);
  return (m ? m[0] : text).trim();
}

export function detectPlatform(text: string): Platform | null {
  let u: URL;
  try {
    u = new URL(extractUrl(text));
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  for (const [p, domains] of Object.entries(DOMAINS) as [Platform, string[]][]) {
    if (domains.some((d) => host === d || host.endsWith('.' + d))) return p;
  }
  return null;
}
