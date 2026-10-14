// Hostname allow-list. Matching is on the parsed hostname (suffix match on a dot boundary),
// never a substring of the raw URL, so "evil.com/?u=youtube.com" and "youtube.com.evil.com" are rejected.
const PLATFORMS = {
  youtube: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
  instagram: ['instagram.com', 'instagr.am'],
  facebook: ['facebook.com', 'fb.watch', 'fb.com'],
  tiktok: ['tiktok.com'],
};

export function detectPlatform(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  for (const [platform, domains] of Object.entries(PLATFORMS)) {
    if (domains.some((d) => host === d || host.endsWith('.' + d))) {
      return { platform, url: u.toString() };
    }
  }
  return null;
}
