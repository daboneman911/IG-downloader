import { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons';

const STEPS = [
  {
    title: 'Paste the link',
    body: 'In the app, tap Share › Copy link. Come back here and tap Paste.',
  },
  {
    title: 'Pick a quality & tap Download',
    body: 'Keep this page open until the progress bar finishes.',
  },
  {
    title: 'Tap “Save to Photos”',
    body: 'The iPhone share sheet opens. Choose Save Video (or Save Image). It’s now in your Camera Roll.',
  },
];

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  // <dialog> gives us focus trapping, Esc-to-close and an inert background for free.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="help-title"
      className="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-md"
    >
      <div className="rounded-t-3xl bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-neutral-900 shadow-2xl sm:rounded-3xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="flex items-center justify-between">
          <h2 id="help-title" className="text-lg font-bold">
            How to save to your iPhone
          </h2>
          <button
            onClick={onClose}
            className="-mr-2 grid size-11 place-items-center rounded-full text-neutral-500 active:bg-neutral-100 dark:active:bg-neutral-800"
            aria-label="Close"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <ol className="mt-3 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-2xl bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          No “Save Video” option? Use <b>Save to Files</b> instead, then open the Files app › Downloads, tap the
          video › Share › Save Video. Tip: Share › <b>Add to Home Screen</b> installs this as an app.
        </p>
        <button
          onClick={onClose}
          className="mt-4 h-12 w-full rounded-2xl bg-neutral-900 font-semibold text-white active:opacity-80 dark:bg-white dark:text-neutral-900"
        >
          Got it
        </button>
      </div>
    </dialog>
  );
}
