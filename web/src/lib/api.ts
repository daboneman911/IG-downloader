export type Platform = 'youtube' | 'instagram' | 'facebook' | 'tiktok';

export interface FormatOption {
  format: string;
  label: string;
  ext: 'mp4' | 'mp3' | 'jpg' | 'png' | 'webp' | string;
}

export interface MediaItem {
  index: number;
  kind: 'video' | 'image';
  title: string | null;
  thumbnail: string | null;
  duration: number | null;
  options: FormatOption[];
}

export interface InfoResponse {
  id: string;
  platform: Platform;
  title: string;
  author: string | null;
  thumbnail: string | null;
  duration: number | null;
  items: MediaItem[];
}

// Empty = same origin (vite dev proxy, docker nginx). Set VITE_API_BASE when the API is on another host.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export const apiUrl = (path: string) => BASE + path;

async function errorFrom(res: Response): Promise<Error> {
  try {
    const j = await res.json();
    if (j?.error) return new Error(j.error);
  } catch {
    /* not JSON */
  }
  if (res.status === 429) return new Error('Too many requests. Wait a minute and try again.');
  return new Error(`Server error (${res.status}). Try again.`);
}

export async function fetchInfo(url: string, signal?: AbortSignal): Promise<InfoResponse> {
  let res: Response;
  try {
    res = await fetch(apiUrl('/api/info'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Could not reach the server. Check your connection.');
  }
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

export function downloadUrl(id: string, format: string, item: number) {
  const q = new URLSearchParams({ id, format, item: String(item) });
  return apiUrl(`/api/download?${q}`);
}

export interface Progress {
  loaded: number;
  total: number | null;
  /** Server is still fetching/converting; no bytes yet. */
  preparing: boolean;
}

/** Fetch the file into a Blob (needed for navigator.share), reporting progress as it streams. */
export async function downloadFile(
  url: string,
  fallbackName: string,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<File> {
  onProgress({ loaded: 0, total: null, preparing: true });
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Download failed. Check your connection and try again.');
  }
  if (!res.ok) throw await errorFrom(res);

  const total = Number(res.headers.get('Content-Length')) || null;
  const type = res.headers.get('Content-Type') || 'application/octet-stream';
  const name = filenameFrom(res.headers.get('Content-Disposition')) || fallbackName;

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = res.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress({ loaded, total, preparing: false });
  }
  return new File(chunks as BlobPart[], name, { type });
}

function filenameFrom(cd: string | null): string | null {
  if (!cd) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* fall through */
    }
  }
  return /filename="([^"]+)"/i.exec(cd)?.[1] ?? null;
}
