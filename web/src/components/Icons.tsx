import type { SVGProps } from 'react';
import type { Platform } from '../lib/api';

type P = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const YouTubeIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
    <path d="M10 9.2v5.6l4.8-2.8z" className="fill-white dark:fill-neutral-900" />
  </svg>
);

export const InstagramIcon = (p: P) => (
  <svg {...base} {...p} {...stroke}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);

export const FacebookIcon = (p: P) => (
  <svg {...base} {...p}>
    <path
      fill="currentColor"
      d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4a20 20 0 0 0-2.2-.1c-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21z"
    />
  </svg>
);

export const TikTokIcon = (p: P) => (
  <svg {...base} {...p}>
    <path
      fill="currentColor"
      d="M16.6 3h-3.1v12.2a2.7 2.7 0 1 1-2.7-2.7c.3 0 .6 0 .8.1V9.4a5.9 5.9 0 1 0 5 5.8V9a7.4 7.4 0 0 0 4.3 1.4V7.3A4.3 4.3 0 0 1 16.6 3z"
    />
  </svg>
);

export const PLATFORM_ICON: Record<Platform, (p: P) => React.JSX.Element> = {
  youtube: YouTubeIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
};

export const PasteIcon = (p: P) => (
  <svg {...base} {...p} {...stroke}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p} {...stroke}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const HelpIcon = (p: P) => (
  <svg {...base} {...p} {...stroke}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);

export const DownloadIcon = (p: P) => (
  <svg {...base} {...p} {...stroke}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
);

export const ShareIcon = (p: P) => (
  <svg {...base} {...p} {...stroke}>
    <path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

export const FolderIcon = (p: P) => (
  <svg {...base} {...p} {...stroke}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const Spinner = (p: P) => (
  <svg {...base} {...p} className={'animate-spin ' + (p.className ?? '')}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
