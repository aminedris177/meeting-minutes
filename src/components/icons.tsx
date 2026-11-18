// أيقونات SVG داخلية (بدون مكتبات خارجية).
import type { JSX, SVGAttributes } from 'preact';

type P = SVGAttributes<SVGSVGElement>;

const base = (children: JSX.Element | JSX.Element[], props: P) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const HomeIcon = (p: P) =>
  base([<path d="M3 11l9-7 9 7" />, <path d="M5 10v10h14V10" />, <path d="M10 20v-6h4v6" />], p);

export const MeetingsIcon = (p: P) =>
  base(
    [
      <rect x="3" y="5" width="18" height="16" rx="2" />,
      <path d="M3 10h18M8 3v4M16 3v4" />,
      <path d="M8 14h3M8 17h6" />,
    ],
    p,
  );

export const FollowupIcon = (p: P) =>
  base([<path d="M9 6h11M9 12h11M9 18h11" />, <path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11" />, <circle cx="5" cy="18" r="1.4" />], p);

export const ArchiveIcon = (p: P) =>
  base([<rect x="3" y="4" width="18" height="5" rx="1" />, <path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9" />, <path d="M10 13h4" />], p);

export const SettingsIcon = (p: P) =>
  base(
    [
      <circle cx="12" cy="12" r="3" />,
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />,
    ],
    p,
  );

/** أيقونة المشاركة في iOS: مربع وسهم لأعلى */
export const IOSShareIcon = (p: P) =>
  base([<path d="M12 3v12" />, <path d="M8 7l4-4 4 4" />, <path d="M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1" />], p);

export const AddSquareIcon = (p: P) =>
  base([<rect x="4" y="4" width="16" height="16" rx="3" />, <path d="M12 8v8M8 12h8" />], p);

export const RefreshIcon = (p: P) =>
  base([<path d="M20 11a8 8 0 10-2.3 5.7" />, <path d="M20 4v7h-7" />], p);
