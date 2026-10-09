import { createContext, useContext, useMemo, useSyncExternalStore, type CSSProperties, type HTMLAttributes } from "react";
import { MotionConfig } from "motion/react";
import { AttuneProvider, type FeelState } from "./feel";
import { buildTokenStyle } from "../tokens/css";
import type { ColorToken } from "../tokens/tokens";

export type AttuneMaterial = "solid" | "frosted";
type Scope = { style?: CSSProperties; "data-at-material"?: AttuneMaterial; "data-reduced-motion"?: "true" | "false" };
const SurfaceContext = createContext<Scope>({});
/** Portals carry their owning root's tokens, material and motion preference. */
export const useAttuneScope = () => useContext(SurfaceContext);

function mediaStore(query: string) {
  return {
    subscribe: (notify: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    snapshot: () => typeof window !== "undefined" && window.matchMedia(query).matches,
    server: () => false,
  };
}
const darkMedia = mediaStore("(prefers-color-scheme: dark)");
const motionMedia = mediaStore("(prefers-reduced-motion: reduce)");
const transparencyMedia = mediaStore("(prefers-reduced-transparency: reduce)");
const limit = (value: number, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export type AttuneRootProps = HTMLAttributes<HTMLDivElement> & {
  theme?: "light" | "dark" | "system";
  material?: AttuneMaterial;
  /** Background blur in px; the opaque fallback is retained in CSS. */
  blur?: number;
  /** Surface tint coverage, from 0.55 to 1. */
  opacity?: number;
  /** Container radius only. Animated control geometry keeps its tuned radius. */
  panelRadius?: number;
  colors?: Partial<Record<ColorToken, string>>;
  feel?: Partial<FeelState>;
};

/** Mount a tool UI without changing the host's theme, typography or motion settings. */
export function AttuneRoot({ theme = "system", material = "solid", blur = 18, opacity = 0.78, panelRadius = 12, colors, feel, style, className, children, ...rest }: AttuneRootProps) {
  const systemDark = useSyncExternalStore(darkMedia.subscribe, darkMedia.snapshot, darkMedia.server);
  const systemReduced = useSyncExternalStore(motionMedia.subscribe, motionMedia.snapshot, motionMedia.server);
  const lessTransparency = useSyncExternalStore(transparencyMedia.subscribe, transparencyMedia.snapshot, transparencyMedia.server);
  const resolvedTheme = theme === "system" ? systemDark ? "dark" : "light" : theme;
  const reduced = feel?.reduced ?? systemReduced;
  const scope = useMemo<Scope>(() => ({
    "data-at-material": lessTransparency ? "solid" : material,
    "data-reduced-motion": reduced ? "true" : "false",
    style: {
      ...buildTokenStyle(resolvedTheme),
      ...Object.fromEntries(Object.entries(colors ?? {}).map(([key, value]) => [`--at-color-${key}`, value])),
      "--at-surface-blur": `${limit(blur, 0, 40, 18)}px`,
      "--at-surface-opacity": `${limit(opacity, 0.55, 1, 0.78) * 100}%`,
      "--at-radius-lg": `${limit(panelRadius, 0, 32, 12)}px`,
      ...(reduced ? Object.fromEntries(["micro", "fast", "base", "moderate", "slow"].map(key => [`--at-motion-duration-${key}`, "0ms"])) : {}),
    } as CSSProperties,
  }), [resolvedTheme, colors, material, lessTransparency, blur, opacity, panelRadius, reduced]);
  return <SurfaceContext.Provider value={scope}>
    <AttuneProvider value={{ ...feel, reduced }}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        <div {...rest} {...scope} className={`at-root ${className ?? ""}`} style={{ ...scope.style, ...style }}>{children}</div>
      </MotionConfig>
    </AttuneProvider>
  </SurfaceContext.Provider>;
}
