/**
 * Attune UI design tokens — single source of truth.
 * Handoff §10. CSS variables are generated from this file (see css.ts),
 * spring / feel tokens are consumed directly by components in TS.
 */

/* ---------------------------------------------------------------- color */

export const color = {
  light: {
    "bg-canvas": "#F5F6F8",
    "surface-panel": "#FFFFFF",
    "surface-sunken": "#EEF0F3",
    "surface-raised": "#FFFFFF",
    "surface-hover": "#E5E9EF",
    "surface-overlay": "rgba(245,246,248,0.72)",
    "border-subtle": "#DFE3E9",
    "border-default": "#CED5DF",
    "border-strong": "#A9B4C5",
    "text-primary": "#252B35",
    "text-secondary": "#606B7B",
    "text-tertiary": "#6A7484",
    "accent-default": "#4B5261",
    "accent-hover": "#3D4554",
    "accent-subtle": "#E5E9EF",
    "accent-contrast": "#FFFFFF",
    "control-thumb": "#FFFFFF",
    "slider-fill": "#4B5261",
    "slider-thumb": "#FFFFFF",
    "fill-primary": "#4B5261",
    "fill-primary-hover": "#3D4554",
    "fill-primary-contrast": "#FFFFFF",
    "focus-ring": "rgba(75,82,97,0.72)",
    "highlight-line": "rgba(255,255,255,0.9)",
    "danger": "#DC3B30",
    "shadow-color": "rgba(25,34,48,0.10)",
    "shadow-color-soft": "rgba(25,34,48,0.06)",
  },
  dark: {
    "bg-canvas": "#121419",
    "surface-panel": "#1B1F26",
    "surface-sunken": "#14181E",
    "surface-raised": "#262D38",
    "surface-hover": "#2B3441",
    "surface-overlay": "rgba(12,15,20,0.64)",
    "border-subtle": "#2F3744",
    "border-default": "#404B5B",
    "border-strong": "#5D6B80",
    "text-primary": "#E8EDF4",
    "text-secondary": "#AFBACB",
    "text-tertiary": "#95A3B8",
    "accent-default": "#AABBD4",
    "accent-hover": "#C0CDE0",
    "accent-subtle": "#2C3543",
    "accent-contrast": "#14181E",
    "control-thumb": "#FFFFFF",
    "slider-fill": "#5F738E",
    "slider-thumb": "#FFFFFF",
    "fill-primary": "#556983",
    "fill-primary-hover": "#5D728D",
    "fill-primary-contrast": "#FFFFFF",
    "focus-ring": "rgba(170,187,212,0.80)",
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

/** Layout slots; animated outlines may paint outside without moving siblings. */
export type ControlSize = "sm" | "md" | "lg";
export const controlHeight = (density: ControlSize = "md") => size[`control-${density}`];

export const radius = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, control: 9999, full: 9999 } as const;

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
