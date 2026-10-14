import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadFile, downloadUrl, fetchInfo, type InfoResponse, type Progress } from './lib/api';
import { detectPlatform, extractUrl, PLATFORMS } from './lib/platform';
import { canShareFiles, formatBytes, isIOS, saveViaLink, shareFile } from './lib/share';
import { HelpSheet } from './components/HelpSheet';
import { PreviewCard } from './components/PreviewCard';
import { DownloadIcon, FolderIcon, HelpIcon, PasteIcon, PLATFORM_ICON, ShareIcon, Spinner } from './components/Icons';

type Phase = 'idle' | 'fetching' | 'ready' | 'downloading' | 'done';

const QUALITY_KEY = 'grabdl.quality';
const readPref = () => {
  try {
    return localStorage.getItem(QUALITY_KEY);
  } catch {
    return null;
  }
};
const writePref = (v: string) => {
  try {
    localStorage.setItem(QUALITY_KEY, v);
  } catch {
    /* private mode */
  }
};

// Deep link: /?url=<link> (iOS Shortcuts, bookmarklets) or ?text= from a share target. Read once at
// load (not in an effect) so StrictMode's double-mount can't consume it before the real mount.
const DEEP_LINK = (() => {
  const q = new URLSearchParams(location.search);
  const v = q.get('url') || q.get('text');
  try {
    if (v) history.replaceState(null, '', location.pathname);
  } catch {
    /* sandboxed/embedded contexts can refuse history writes; the link still works */
  }
  return v;
})();

export default function App() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [itemIndex, setItemIndex] = useState(1);
  const [format, setFormat] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shareable = useMemo(canShareFiles, []);
  const detected = detectPlatform(url);
  const item = info?.items.find((i) => i.index === itemIndex) ?? info?.items[0];
  const option = item?.options.find((o) => o.format === format);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (DEEP_LINK) lookup(DEEP_LINK);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickDefaultFormat(next: InfoResponse, index: number) {
    const opts = next.items.find((i) => i.index === index)?.options ?? [];
    const pref = readPref();
    const choice =
      opts.find((o) => o.format === pref) ?? opts.find((o) => o.format === '720') ?? opts.find((o) => o.ext !== 'mp3') ?? opts[0];
    setFormat(choice?.format ?? '');
  }

  async function lookup(raw: string) {
    const clean = extractUrl(raw);
    if (!clean) return;
    if (!detectPlatform(clean)) {
      setError('Paste a YouTube, Instagram, Facebook or TikTok link.');
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setUrl(clean);
    setError(null);
    setInfo(null);
    setFile(null);
    setPhase('fetching');
    inputRef.current?.blur(); // drop the keyboard so the preview is visible
    try {
      const next = await fetchInfo(clean, ac.signal);
      setInfo(next);
      setItemIndex(next.items[0].index);
      pickDefaultFormat(next, next.items[0].index);
      setPhase('ready');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
      setPhase('idle');
    }
  }

  async function onPasteButton() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) return lookup(text);
    } catch {
      /* permission denied or unsupported (Firefox): fall back to manual paste */
    }
    inputRef.current?.focus();
    setError('Long-press the box and choose Paste.');
  }

  async function startDownload() {
    if (!info || !item || !option) return;
    writePref(option.format);
    const href = downloadUrl(info.id, option.format, item.index);

    // Without file sharing (desktop browsers) let the browser's download manager stream straight to
    // disk instead of buffering the whole file in page memory.
    if (!shareable) {
      window.location.href = href;
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    setShared(false);
    setPhase('downloading');
    try {
      const f = await downloadFile(href, `${info.title}.${option.ext}`, setProgress, ac.signal);
      setFile(f);
      setPhase('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
      setPhase('ready');
    } finally {
      setProgress(null);
    }
  }

  function cancelDownload() {
    abortRef.current?.abort();
    setProgress(null);
    setPhase('ready');
  }

  async function onShare() {
    if (!file) return;
    try {
      setShared(await shareFile(file, info?.title));
    } catch {
      setError('Sharing failed. Use “Save to Files” instead.');
    }
  }

  function reset() {
    abortRef.current?.abort();
    setUrl('');
    setInfo(null);
    setFile(null);
    setError(null);
    setPhase('idle');
    inputRef.current?.focus();
  }

  const busy = phase === 'fetching' || phase === 'downloading';
  const pct = progress?.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null;
  const isAudio = option?.ext === 'mp3';

  return (
    <div className="min-h-dvh bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 text-white dark:from-[#1b1030] dark:via-[#2a0f2e] dark:to-[#3a0d22]">
      {/* Top bar sits below the notch/Dynamic Island via safe-area padding. */}
      <header className="mx-auto flex max-w-md items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
        <button onClick={reset} className="flex min-h-11 items-center gap-2 text-xl font-extrabold tracking-tight">
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg ring-2 ring-white/30" />
          GrabDL
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white/90 active:bg-white/15"
        >
          <HelpIcon className="size-5" /> How to save
        </button>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 pt-4 pb-[calc(9rem+env(safe-area-inset-bottom))]">
        {/* Platform strip: decorative + live auto-detect indicator, like fastdl's tab row. */}
        <nav aria-label="Supported platforms" className="grid grid-cols-4 gap-1 rounded-2xl bg-white/15 p-1 backdrop-blur">
          {PLATFORMS.map((p) => {
            const Icon = PLATFORM_ICON[p.id];
            const active = (info?.platform ?? detected) === p.id;
            return (
              <div
                key={p.id}
                title={p.hint}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition ${
                  active ? 'bg-white text-violet-700 shadow dark:bg-white/90' : 'text-white/85'
                }`}
              >
                <Icon className="size-5" />
                {p.name}
              </div>
            );
          })}
        </nav>

        {!info && (
          <div className="pt-2 text-center">
            <h1 className="text-[1.75rem] leading-tight font-extrabold">Video Downloader</h1>
            <p className="mt-1 text-white/85">Instagram, TikTok, YouTube &amp; Facebook — straight to your Photos.</p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(url);
          }}
          className="flex overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/15 dark:bg-neutral-900"
        >
          <label htmlFor="url" className="sr-only">
            Video link
          </label>
          <input
            ref={inputRef}
            id="url"
            type="url"
            inputMode="url"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Paste a video link…"
            value={url}
            disabled={busy}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onPaste={(e) => {
              // Auto-detect: start fetching as soon as a supported link is pasted.
              const text = e.clipboardData.getData('text');
              if (detectPlatform(text)) {
                e.preventDefault();
                lookup(text);
              }
            }}
            // 16px+ font stops iOS Safari from zooming the page on focus.
            className="min-h-16 min-w-0 flex-1 bg-transparent px-4 text-base text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
          />
          <button
            type="button"
            onClick={onPasteButton}
            disabled={busy}
            className="flex min-w-24 items-center justify-center gap-1.5 border-l border-neutral-200 bg-neutral-50 px-4 font-semibold text-neutral-700 active:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            <PasteIcon className="size-5" /> Paste
          </button>
        </form>

        {error && (
          <p role="alert" className="rounded-2xl bg-black/25 px-4 py-3 text-sm font-medium backdrop-blur">
            {error}
          </p>
        )}

        {phase === 'fetching' && (
          <div className="overflow-hidden rounded-3xl bg-white/15 backdrop-blur" aria-busy="true">
            <div className="aspect-video animate-pulse bg-white/15" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/25" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-white/20" />
            </div>
          </div>
        )}

        {info && item && (
          <PreviewCard
            info={info}
            item={item}
            format={format}
            disabled={busy}
            onItem={(i) => {
              setItemIndex(i);
              setFile(null);
              pickDefaultFormat(info, i);
              if (phase === 'done') setPhase('ready');
            }}
            onFormat={(f) => {
              setFormat(f);
              setFile(null);
              if (phase === 'done') setPhase('ready');
            }}
            onClear={reset}
          />
        )}

        {!info && phase === 'idle' && (
          <ol className="grid grid-cols-3 gap-2 text-center text-xs font-medium text-white/90">
            {['Copy the link', 'Paste it here', 'Save to Photos'].map((s, i) => (
              <li key={s} className="rounded-2xl bg-white/10 px-2 py-3">
                <span className="mb-1 block text-lg font-extrabold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        )}

        <footer className="pt-4 text-center text-xs leading-relaxed text-white/70">
          For downloading content you own or have permission to use. Private, login-only and paywalled content is not
          supported. Respect creators and each platform’s terms. Not affiliated with Instagram, TikTok, YouTube or
          Facebook.
        </footer>
      </main>

      {/* Primary actions live in a bottom bar for one-handed reach. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-black/20 backdrop-blur-xl dark:bg-black/40">
        <div className="mx-auto max-w-md space-y-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {phase === 'done' && file ? (
            <>
              {shareable && (
                <button onClick={onShare} className="btn-primary">
                  <ShareIcon className="size-5" />
                  {isAudio ? 'Share / Save audio' : shared ? 'Share again' : 'Save to Photos'}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => saveViaLink(file)} className="btn-secondary">
                  <FolderIcon className="size-5" /> Save to Files
                </button>
                <button onClick={reset} className="btn-secondary">
                  New link
                </button>
              </div>
              <p className="text-center text-xs text-white/70">
                {file.name.length > 40 ? file.name.slice(0, 37) + '…' : file.name} · {formatBytes(file.size)}
                {isIOS() && !isAudio && shared && ' · Choose “Save Video” in the sheet'}
              </p>
            </>
          ) : phase === 'downloading' ? (
            <button onClick={cancelDownload} className="btn-primary relative overflow-hidden" aria-live="polite">
              <span
                className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-300"
                style={{ width: `${pct ?? 0}%` }}
              />
              <span className="relative flex items-center gap-2">
                <Spinner className="size-5" />
                {progress?.preparing || !progress
                  ? 'Preparing file…'
                  : pct !== null
                    ? `Downloading ${pct}%`
                    : `Downloading ${formatBytes(progress.loaded)}`}
                <span className="text-sm font-medium opacity-75">· tap to cancel</span>
              </span>
            </button>
          ) : phase === 'ready' && option ? (
            <button onClick={startDownload} className="btn-primary">
              <DownloadIcon className="size-5" /> Download {option.label}
            </button>
          ) : (
            <button
              onClick={() => lookup(url)}
              disabled={phase === 'fetching' || !url.trim()}
              className="btn-primary"
            >
              {phase === 'fetching' ? (
                <>
                  <Spinner className="size-5" /> Fetching video…
                </>
              ) : (
                <>
                  <DownloadIcon className="size-5" /> Download
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
