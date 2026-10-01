/**
 * Attune UI design tokens — single source of truth.
 * Handoff §10. CSS variables are generated from this file (see css.ts),
 * spring / feel tokens are consumed directly by components in TS.
 */

/* ---------------------------------------------------------------- color */

export const color = {
  light: {
    "bg-canvas": "#F5F5F4",
    "surface-panel": "#FFFFFF",
    "surface-sunken": "#F0F0EF",
    "surface-raised": "#FFFFFF",
    "surface-hover": "#EBEBEA",
    "surface-overlay": "rgba(245,245,244,0.72)",
    "border-subtle": "#E7E7E5",
    "border-default": "#D9D9D6",
    "border-strong": "#BDBDB8",
    "text-primary": "#1C1C1E",
    "text-secondary": "#6B6B70",
    "text-tertiary": "#9C9CA1",
    "accent-default": "#F2600C",
    "accent-hover": "#DB5306",
    "accent-subtle": "#FDEBDD",
    "accent-contrast": "#FFFFFF",
    "control-thumb": "#FFFFFF",
    "fill-primary": "#1C1C1E",
    "fill-primary-hover": "#2E2E31",
    "fill-primary-contrast": "#FFFFFF",
    "focus-ring": "rgba(242,96,12,0.40)",
    "highlight-line": "rgba(255,255,255,0.9)",
    "danger": "#DC3B30",
    "shadow-color": "rgba(20,20,22,0.10)",
    "shadow-color-soft": "rgba(20,20,22,0.06)",
  },
  dark: {
    "bg-canvas": "#0F0F10",
    "surface-panel": "#18181A",
    "surface-sunken": "#111113",
    "surface-raised": "#232326",
    "surface-hover": "#26262A",
    "surface-overlay": "rgba(10,10,11,0.64)",
    "border-subtle": "#26262A",
    "border-default": "#333338",
    "border-strong": "#4A4A50",
    "text-primary": "#EDEDEF",
    "text-secondary": "#9A9AA2",
    "text-tertiary": "#6B6B72",
    "accent-default": "#FF7A2E",
    "accent-hover": "#FF8C4A",
    "accent-subtle": "#3A2216",
    "accent-contrast": "#1A0E07",
    "control-thumb": "#E8E8EA",
    "fill-primary": "#EDEDEF",
    "fill-primary-hover": "#FFFFFF",
    "fill-primary-contrast": "#111113",
    "focus-ring": "rgba(255,122,46,0.50)",
    "highlight-line": "rgba(255,255,255,0.08)",
    "danger": "#FF6259",
    "shadow-color": "rgba(0,0,0,0.40)",
    "shadow-color-soft": "rgba(0,0,0,0.28)",
  },
} as const;

export type ColorToken = keyof (typeof color)["light"];

/* ----------------------------------------------------------- typography */

export const font = {
  sans: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
} as const;

export const text = {
  caption: { size: 11, line: 16, weight: 400 },
  body: { size: 12, line: 16, weight: 400 },
  value: { size: 12, line: 16, weight: 500 },
  label: { size: 12, line: 16, weight: 600 },
  title: { size: 14, line: 20, weight: 600 },
  display: { size: 20, line: 28, weight: 600 },
} as const;

/* ------------------------------------------------------- space & size */

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

export const size = {
  "control-sm": 24,
  "control-md": 28,
  "control-lg": 32,
  "panel-width": 320,
  "label-width": 96,
  "value-width": 64,
} as const;

export const radius = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, full: 9999 } as const;

export const border = { width: 1, focusWidth: 2, focusOffset: 2 } as const;

/* --------------------------------------------------------------- motion */

/** Durations in ms. Handoff §4.9 rule 2 */
export const duration = {
  instant: 0,
  micro: 100,
  fast: 160,
  base: 240,
  moderate: 320,
  slow: 440,
} as const;

/** Exit / collapse = enter × exitScale (§4.9 rule 3) */
export const exitScale = 0.75;

export const ease = {
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  in: [0.4, 0, 1, 1] as [number, number, number, number],
};

export type SpringToken = { visualDuration: number; bounce: number };

/** Springs, described as "how long to settle + how much bounce" (§4.9 rule 4) */
export const spring = {
  follow: { visualDuration: 0.12, bounce: 0 },
  snappy: { visualDuration: 0.24, bounce: 0.1 },
  soft: { visualDuration: 0.32, bounce: 0.2 },
  pop: { visualDuration: 0.44, bounce: 0.15 },
  pluck: { visualDuration: 0.4, bounce: 0.55 },
} satisfies Record<string, SpringToken>;

export type SpringName = keyof typeof spring;

export const valueRoll = {
  distance: 0.6, // em
  blur: 2, // px
};

/* --------------------------------------------------------- shared feel */

/** Shared feel parameters — affect every component (§10.7, rules in §4.7) */
export const feel = {
  passiveStrength: 0.4,
  falloffRadius: 3,
  volumeConservation: 0.6,
  edgeResistance: 0.35,
  edgeMaxStretch: 8,
  deformScale: 1,
};

export type SharedFeel = typeof feel;
