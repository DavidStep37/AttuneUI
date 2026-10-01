import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, useMotionValue, type MotionValue, type Transition } from "motion/react";

/** A motion value plus an imperative, interruptible `to(target, transition)`. */
export function useAnimated(initial: number) {
  const mv = useMotionValue(initial);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  const to = useCallback(
    (target: number, transition: Transition, onUpdate?: (v: number) => void) => {
      ctrl.current?.stop();
      if ((transition as { duration?: number }).duration === 0) {
        mv.set(target);
        onUpdate?.(target);
        ctrl.current = null;
        return;
      }
      ctrl.current = animate(mv, target, { ...(transition as object), onUpdate } as never);
    },
    [mv],
  );
  const set = useCallback(
    (v: number) => {
      ctrl.current?.stop();
      ctrl.current = null;
      mv.set(v);
    },
    [mv],
  );
  const stop = useCallback(() => {
    ctrl.current?.stop();
    ctrl.current = null;
  }, []);
  useEffect(() => () => ctrl.current?.stop(), []);
  return { mv, to, set, stop } as { mv: MotionValue<number>; to: typeof to; set: typeof set; stop: typeof stop };
}

/** Element size via ResizeObserver. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Latest-value ref (for use inside stable callbacks). */
export function useLatest<T>(v: T) {
  const r = useRef(v);
  r.current = v;
  return r;
}

let focusVisibleFlag = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab" || e.key.startsWith("Arrow")) focusVisibleFlag = true;
  }, true);
  window.addEventListener("pointerdown", () => (focusVisibleFlag = false), true);
}
/** true when the last interaction was keyboard (for focus-visible driven effects) */
export const isKeyboardModality = () => focusVisibleFlag;
