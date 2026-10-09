import { border, color, duration, ease, font, radius, size, space, text } from "./tokens";
import type { CSSProperties } from "react";

const px = (n: number) => `${n}px`;
const bez = (b: readonly number[]) => `cubic-bezier(${b.join(", ")})`;

function colorVars(theme: "light" | "dark") {
  return Object.entries(color[theme])
    .map(([k, v]) => `  --at-color-${k}: ${v};`)
    .join("\n");
}

function staticVars() {
  const lines: string[] = [];
  lines.push(`  --at-font-sans: ${font.sans};`, `  --at-font-mono: ${font.mono};`);
  for (const [k, v] of Object.entries(text)) {
    lines.push(`  --at-text-${k}-size: ${px(v.size)};`, `  --at-text-${k}-line: ${px(v.line)};`, `  --at-text-${k}-weight: ${v.weight};`);
  }
  for (const [k, v] of Object.entries(space)) lines.push(`  --at-space-${k}: ${px(v)};`);
  for (const [k, v] of Object.entries(size)) lines.push(`  --at-size-${k}: ${px(v)};`);
  for (const [k, v] of Object.entries(radius)) lines.push(`  --at-radius-${k}: ${px(v)};`);
  lines.push(
    `  --at-border-width: ${px(border.width)};`,
    `  --at-focus-width: ${px(border.focusWidth)};`,
    `  --at-focus-offset: ${px(border.focusOffset)};`,
  );
  for (const [k, v] of Object.entries(duration)) lines.push(`  --at-motion-duration-${k}: ${v}ms;`);
  for (const [k, v] of Object.entries(ease)) lines.push(`  --at-ease-${k}: ${bez(v)};`);
  lines.push(
    `  --at-shadow-popover: 0 4px 16px var(--at-color-shadow-color-soft), 0 0 0 1px var(--at-color-border-subtle);`,
    `  --at-shadow-panel: 0 8px 32px var(--at-color-shadow-color), 0 0 0 1px var(--at-color-border-subtle);`,
  );
  return lines.join("\n");
}

/** The same tokens as buildTokenCSS, scoped to a mount point instead of :root. */
export function buildTokenStyle(theme: "light" | "dark"): CSSProperties {
  const entries = `${staticVars()}\n${colorVars(theme)}`.split("\n").map((line) => {
    const colon = line.indexOf(":");
    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim().replace(/;$/, "")];
  });
  return { ...Object.fromEntries(entries), colorScheme: theme };
}

/** Build the full token stylesheet (light default, dark via attribute or system). */
export function buildTokenCSS() {
  return `:root {
${staticVars()}
${colorVars("light")}
  color-scheme: light;
}
:root[data-theme="dark"] {
${colorVars("dark")}
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${colorVars("dark")}
    color-scheme: dark;
  }
}
:root[data-reduced-motion="true"] {
  --at-motion-duration-fast: 0ms;
  --at-motion-duration-base: 0ms;
  --at-motion-duration-moderate: 0ms;
  --at-motion-duration-slow: 0ms;
}
`;
}

let injected = false;
export function injectTokens() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.dataset.attune = "tokens";
  style.textContent = buildTokenCSS();
  document.head.prepend(style);
}
