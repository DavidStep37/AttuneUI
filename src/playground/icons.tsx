const base = { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconPlay = () => (
  <svg {...base}>
    <path d="M4.5 3.2v7.6L10.6 7z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconReplay = () => (
  <svg {...base}>
    <path d="M2.8 7a4.2 4.2 0 1 0 1.3-3" />
    <path d="M3.6 1.8v2.4H6" />
  </svg>
);
export const IconReset = () => (
  <svg {...base}>
    <path d="M11.2 7A4.2 4.2 0 1 1 9.9 4" />
    <path d="M10.4 1.8v2.4H8" />
  </svg>
);
export const IconCopy = () => (
  <svg {...base}>
    <rect x="4.6" y="4.6" width="7" height="7" rx="1.6" />
    <path d="M9.4 4.4V3.6A1.2 1.2 0 0 0 8.2 2.4H3.6a1.2 1.2 0 0 0-1.2 1.2v4.6a1.2 1.2 0 0 0 1.2 1.2h.8" />
  </svg>
);
export const IconCheck = () => (
  <svg {...base}>
    <path d="M3 7.3 5.7 10 11 4.2" />
  </svg>
);
export const IconExpand = () => (
  <svg {...base}>
    <path d="M8.2 2.6h3.2v3.2M5.8 11.4H2.6V8.2M11.4 2.6 8 6M2.6 11.4 6 8" />
  </svg>
);
export const IconPlus = () => (
  <svg {...base}>
    <path d="M7 3v8M3 7h8" />
  </svg>
);
export const IconMinus = () => (
  <svg {...base}>
    <path d="M3 7h8" />
  </svg>
);
export const IconClose = () => (
  <svg {...base}>
    <path d="M3.8 3.8l6.4 6.4m0-6.4-6.4 6.4" />
  </svg>
);

export const Logo = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
    <path
      d="M2 11c0-2.2 1.3-3 3.2-3 2.3 0 3.6-2.6 5.8-2.6s3.5 2.6 5.8 2.6c1.9 0 3.2.8 3.2 3s-1.3 3-3.2 3c-2.3 0-3.6 2.6-5.8 2.6S7.5 14 5.2 14C3.3 14 2 13.2 2 11z"
      fill="var(--at-color-surface-sunken)"
      stroke="var(--at-color-border-strong)"
    />
    <rect x="8.4" y="6.8" width="5.2" height="8.4" rx="2.6" fill="var(--at-color-accent-default)" />
  </svg>
);
