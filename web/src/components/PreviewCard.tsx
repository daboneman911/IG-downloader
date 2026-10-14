import { apiUrl, type InfoResponse, type MediaItem } from '../lib/api';
import { formatDuration } from '../lib/share';
import { CloseIcon, PLATFORM_ICON } from './Icons';

interface Props {
  info: InfoResponse;
  item: MediaItem;
  format: string;
  disabled: boolean;
  onItem: (index: number) => void;
  onFormat: (format: string) => void;
  onClear: () => void;
}

export function PreviewCard({ info, item, format, disabled, onItem, onFormat, onClear }: Props) {
  const Icon = PLATFORM_ICON[info.platform];
  const thumb = item.thumbnail ?? info.thumbnail;
  const duration = formatDuration(item.duration ?? info.duration);

  return (
    <section className="overflow-hidden rounded-3xl bg-white text-neutral-900 shadow-xl shadow-black/10 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="relative aspect-video bg-neutral-200 dark:bg-neutral-800">
        {thumb && (
          <img src={apiUrl(thumb)} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        )}
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          <Icon className="size-3.5" />
          {item.kind === 'image' ? 'Photo' : 'Video'}
          {info.items.length > 1 && ` ${item.index}/${info.items.length}`}
        </span>
        {duration && (
          <span className="absolute right-3 bottom-3 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
            {duration}
          </span>
        )}
        <button
          onClick={onClear}
          disabled={disabled}
          className="absolute top-2 right-2 grid size-11 place-items-center rounded-full text-white disabled:opacity-40"
          aria-label="Clear and start over"
        >
          <span className="grid size-8 place-items-center rounded-full bg-black/60 backdrop-blur">
            <CloseIcon className="size-4" />
          </span>
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h2 className="line-clamp-2 leading-snug font-semibold">{info.title}</h2>
          {info.author && <p className="mt-0.5 truncate text-sm text-neutral-500">@{info.author.replace(/^@/, '')}</p>}
        </div>

        {info.items.length > 1 && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Carousel</p>
            {/* Edge-to-edge horizontal scroller; negative margin lets thumbs bleed to the card edge. */}
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {info.items.map((it) => (
                <button
                  key={it.index}
                  onClick={() => onItem(it.index)}
                  disabled={disabled}
                  aria-label={`Item ${it.index}`}
                  aria-pressed={it.index === item.index}
                  className={`relative size-16 shrink-0 snap-start overflow-hidden rounded-xl bg-neutral-200 ring-2 ring-offset-2 ring-offset-white transition dark:bg-neutral-800 dark:ring-offset-neutral-900 ${
                    it.index === item.index ? 'ring-violet-500' : 'ring-transparent opacity-70'
                  }`}
                >
                  {it.thumbnail && <img src={apiUrl(it.thumbnail)} alt="" className="size-full object-cover" loading="lazy" />}
                  <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">
                    {it.index}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Quality</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quality">
            {item.options.map((o) => {
              const active = o.format === format;
              return (
                <button
                  key={o.format}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onFormat(o.format)}
                  disabled={disabled}
                  className={`flex min-h-12 items-center justify-between rounded-2xl border-2 px-3.5 text-left text-sm font-semibold transition disabled:opacity-50 ${
                    active
                      ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                      : 'border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {o.label}
                  <span className="text-xs font-medium uppercase opacity-60">{o.ext}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
