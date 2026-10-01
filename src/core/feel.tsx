import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Transition } from "motion/react";
import { feel as feelTokens, spring as springTokens, type SharedFeel, type SpringName, type SpringToken } from "../tokens/tokens";
import { componentSchemas, type ComponentId, type Overrides, type ParamDef, type ResolvedFeel } from "./schema";

export type FeelState = {
  shared: SharedFeel;
  springs: Record<SpringName, SpringToken>;
  overrides: Overrides;
  reduced: boolean;
};

export const defaultFeelState: FeelState = {
  shared: { ...feelTokens },
  springs: { ...springTokens },
  overrides: {},
  reduced: false,
};

const FeelContext = createContext<FeelState>(defaultFeelState);

export function AttuneProvider({ value, children }: { value?: Partial<FeelState>; children: ReactNode }) {
  const merged = useMemo(() => ({ ...defaultFeelState, ...value }) as FeelState, [value]);
  return <FeelContext.Provider value={merged}>{children}</FeelContext.Provider>;
}

export function useFeelState() {
  return useContext(FeelContext);
}

export function resolveDefault(def: ParamDef, state: Pick<FeelState, "shared" | "springs">): number | SpringToken {
  if (def.type === "spring") return def.inherit ? state.springs[def.inherit] : (def.default as SpringToken);
  if (def.inherit) return state.shared[def.inherit];
  return def.default as number;
}

export function resolveComponent<C extends ComponentId>(id: C, state: FeelState): ResolvedFeel<C> {
  const out: Record<string, unknown> = {};
  const ov: Record<string, number | SpringToken> = state.overrides[id] ?? {};
  for (const def of componentSchemas[id] as ParamDef[]) {
    out[def.key] = ov[def.key] ?? resolveDefault(def, state);
  }
  return out as ResolvedFeel<C>;
}

export type FeelRuntime<C extends ComponentId> = {
  p: ResolvedFeel<C>;
  shared: SharedFeel;
  reduced: boolean;
  /** effective deform multiplier (0 when reduced motion) */
  deform: number;
  /** effective passive multiplier */
  passive: number;
  /** transition from a spring token; instant when reduced */
  t: (s: SpringToken, opts?: { exit?: boolean; velocity?: number }) => Transition;
};

export const EXIT_SCALE = 0.75;

export function springTransition(s: SpringToken, reduced: boolean, opts?: { exit?: boolean; velocity?: number }): Transition {
  if (reduced) return { duration: 0 };
  return {
    type: "spring",
    visualDuration: Math.max(0.01, s.visualDuration * (opts?.exit ? EXIT_SCALE : 1)),
    bounce: s.bounce,
    ...(opts?.velocity !== undefined ? { velocity: opts.velocity } : {}),
  };
}

export function useFeel<C extends ComponentId>(id: C, local?: Partial<ResolvedFeel<C>>): FeelRuntime<C> {
  const state = useFeelState();
  return useMemo(() => {
    const p = { ...resolveComponent(id, state), ...(local ?? {}) } as ResolvedFeel<C>;
    const deform = state.reduced ? 0 : state.shared.deformScale;
    return {
      p,
      shared: state.shared,
      reduced: state.reduced,
      deform,
      passive: state.shared.passiveStrength,
      t: (s, opts) => springTransition(s, state.reduced, opts),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, id, local && JSON.stringify(local)]);
}
