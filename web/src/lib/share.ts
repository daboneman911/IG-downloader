/** Can this browser hand a file to the OS share sheet? (iOS 15+ Safari, Android Chrome.) */
export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'probe.mp4', { type: 'video/mp4' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac; touch support gives it away.
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

/**
 * Open the share sheet with the file. Must be called directly from a tap handler: Safari requires
 * transient user activation, so this can't run automatically when the download finishes.
 * Returns false if the user dismissed the sheet.
 */
export async function shareFile(file: File, title?: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false;
    throw e;
  }
}

/** Trigger a regular download of an in-memory file (lands in Files › Downloads on iOS). */
export function saveViaLink(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in Safari; give it time.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatDuration(s: number | null) {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
