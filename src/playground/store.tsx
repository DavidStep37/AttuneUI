import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultFeelState, type FeelState } from "../core/feel";
import type { ComponentId, ParamValue } from "../core/schema";
import { type SharedFeel, type SpringName, type SpringToken } from "../tokens/tokens";

export type Theme = "system" | "light" | "dark";

type Persisted = Pick<FeelState, "shared" | "springs" | "overrides" | "reduced"> & { theme: Theme };

const KEY = "attune-playground-v1";

function load(key: string, baseline: FeelState, theme: Theme): Persisted {
  const sysReduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const base: Persisted = { ...baseline, reduced: sysReduced, theme };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<Persisted>;
    const overrides = { ...d.overrides };
    // Input now has independent drawing/expansion durations. Retire only its
    // obsolete spring override, preserving every other saved component value.
    if (overrides.input && "spring" in overrides.input) {
      const { spring: _legacyInputSpring, ...input } = overrides.input;
      overrides.input = input;
    }
    return {
      shared: { ...baseline.shared, ...d.shared },
      springs: { ...baseline.springs, ...d.springs },
      overrides,
      reduced: d.reduced ?? sysReduced,
      theme: d.theme ?? theme,
    };
  } catch {
    return base;
  }
}

// A different key/baseline requires a keyed component remount (see Proposals).
export function usePlaygroundStore(key = KEY, baseline = defaultFeelState, theme: Theme = "system") {
  const [s, setS] = useState<Persisted>(() => load(key, baseline, theme));

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* Keep the session usable when storage is unavailable. */ }
  }, [s, key]);
  useEffect(() => {
    const root = document.documentElement;
    if (s.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = s.theme;
    root.dataset.reducedMotion = String(s.reduced);
  }, [s.theme, s.reduced]);

  const setShared = useCallback((k: keyof SharedFeel, v: number) => setS((p) => ({ ...p, shared: { ...p.shared, [k]: v } })), []);
  const setSpring = useCallback((k: SpringName, v: SpringToken) => setS((p) => ({ ...p, springs: { ...p.springs, [k]: v } })), []);
  const setOverride = useCallback(
    (c: ComponentId, k: string, v: ParamValue) => setS((p) => ({ ...p, overrides: { ...p.overrides, [c]: { ...p.overrides[c], [k]: v } } })),
    [],
  );
  const resetOverride = useCallback(
    (c: ComponentId, k: string) =>
      setS((p) => {
        const next = { ...p.overrides[c] };
        delete next[k];
        return { ...p, overrides: { ...p.overrides, [c]: next } };
      }),
    [],
  );
  const resetComponent = useCallback((c: ComponentId) => setS((p) => ({ ...p, overrides: { ...p.overrides, [c]: {} } })), []);
  const resetSharedKey = useCallback((k: keyof SharedFeel) => setS((p) => ({ ...p, shared: { ...p.shared, [k]: baseline.shared[k] } })), [baseline]);
  const resetSpringKey = useCallback((k: SpringName) => setS((p) => ({ ...p, springs: { ...p.springs, [k]: baseline.springs[k] } })), [baseline]);
  const resetShared = useCallback(() => setS((p) => ({ ...p, shared: { ...baseline.shared }, springs: { ...baseline.springs } })), [baseline]);
  const resetAll = useCallback(() => setS((p) => ({ ...p, shared: { ...baseline.shared }, springs: { ...baseline.springs }, overrides: {} })), [baseline]);
  const setReduced = useCallback((v: boolean) => setS((p) => ({ ...p, reduced: v })), []);
  const setTheme = useCallback((v: Theme) => setS((p) => ({ ...p, theme: v })), []);

  const feel: FeelState = useMemo(
    () => ({ shared: s.shared, springs: s.springs, overrides: s.overrides, reduced: s.reduced }),
    [s.shared, s.springs, s.overrides, s.reduced],
  );

  return {
    state: s,
    baseline,
    feel,
    setShared,
    setSpring,
    setOverride,
    resetOverride,
    resetComponent,
    resetSharedKey,
    resetSpringKey,
    resetShared,
    resetAll,
    setReduced,
    setTheme,
  };
}

export type PlaygroundStore = ReturnType<typeof usePlaygroundStore>;

const StoreCtx = createContext<PlaygroundStore | null>(null);
export const StoreProvider = ({ store, children }: { store: PlaygroundStore; children: ReactNode }) => (
  <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
);
export const useStore = () => useContext(StoreCtx)!;

/* ------------------------------------------------ demo values (shared card ↔ modal) */

type DemoMap = Record<string, unknown>;
type Updater = (prev: unknown) => unknown;
const DemoCtx = createContext<{ map: DemoMap; update: (k: string, fn: Updater) => void } | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<DemoMap>({});
  const update = useCallback((k: string, fn: Updater) => setMap((m) => ({ ...m, [k]: fn(m[k]) })), []);
  const value = useMemo(() => ({ map, update }), [map, update]);
  return <DemoCtx.Provider value={value}>{children}</DemoCtx.Provider>;
}

export function useDemo<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const { map, update } = useContext(DemoCtx)!;
  const v = (key in map ? map[key] : initial) as T;
  const init = useRef(initial);
  const set = useCallback(
    (n: T | ((p: T) => T)) =>
      update(key, (prev) => {
        const cur = (prev === undefined ? init.current : prev) as T;
        return typeof n === "function" ? (n as (p: T) => T)(cur) : n;
      }),
    [update, key],
  );
  return [v, set];
}
