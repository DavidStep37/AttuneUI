import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { capHalf, clamp, gaussian, profilePath, samples } from "../core/geometry";
import { useAnimated, useLatest, useSize } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";

export type SegmentedOption<V extends string> = { value: V; label: ReactNode; "aria-label"?: string };

export type SegmentedProps<V extends string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (v: V) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  "aria-label"?: string;
  feel?: Partial<ResolvedFeel<"segmented">>;
};

const INSET = 2;

/**
 * Segmented Control — 液体一样从一格流向另一格的选中底色 (Handoff §5.7)
 * Leading edge follows a fast spring, trailing edge a softer one: stretch → neck → merge.
 */
export function Segmented<V extends string>({ options, value, onChange, size = "md", fullWidth, feel: local, ...aria }: SegmentedProps<V>) {
  const { p, t, deform } = useFeel("segmented", local);
  const [ref, box] = useSize<HTMLDivElement>();
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const L = useAnimated(0);
  const R = useAnimated(0);
  const from = useRef({ w: 0 });
  const target = useRef({ l: 0, r: 0, w: 0 });
  const inited = useRef(false);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const pRef = useLatest({ p, t });

  const measure = useCallback(
    (i: number) => {
      const b = btns.current[i];
      if (!b) return null;
      return { l: b.offsetLeft, r: b.offsetLeft + b.offsetWidth };
    },
    [],
  );

  useLayoutEffect(() => {
    const m = measure(idx);
    if (!m) return;
    const w = m.r - m.l;
    if (!inited.current || box.width === 0) {
      L.set(m.l);
      R.set(m.r);
      target.current = { ...m, w };
      from.current.w = w;
      if (box.width > 0) inited.current = true;
      return;
    }
    const prev = target.current;
    if (prev.l === m.l && prev.r === m.r) return;
    const curL = L.mv.get();
    const curR = R.mv.get();
    from.current.w = curR - curL;
    target.current = { ...m, w };
    const movingRight = (m.l + m.r) / 2 > (curL + curR) / 2;
    const { p: pp, t: tt } = pRef.current;
    const head = tt(pp.headSpring);
    const tail = tt(pp.tailSpring);
    (movingRight ? R : L).to(movingRight ? m.r : m.l, head);
    (movingRight ? L : R).to(movingRight ? m.l : m.r, tail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, box.width, measure]);

  const h = box.height - INSET * 2;
  const cy = box.height / 2;
  const d = useTransform([L.mv, R.mv] as const, ([l, r]: number[]) => {
    if (box.width === 0 || r - l <= 0) return "";
    const len = r - l;
    const half = h / 2;
    const base = Math.max(from.current.w, target.current.w);
    const extra = clamp((len - base) / Math.max(1, target.current.w), 0, 1);
    const dip = half * 0.75 * p.neck * deform * extra;
    const mid = (l + r) / 2;
    const sig = len * 0.2;
    const hf = (x: number) => capHalf(x, l, r, half - dip * gaussian(x - mid, sig), 6);
    return profilePath(samples(l, r, 7, 1), hf, () => cy);
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (idx + dir + options.length) % options.length;
    onChange(options[n].value);
    btns.current[n]?.focus();
  };

  return (
    <div
      ref={ref}
      className="at-seg"
      role="radiogroup"
      aria-label={aria["aria-label"]}
      data-size={size}
      data-full={fullWidth || undefined}
      data-at-interactive
      onKeyDown={onKeyDown}
    >
      <svg className="at-seg-svg" width={Math.max(1, box.width)} height={Math.max(1, box.height)} aria-hidden>
        <motion.path className="at-seg-indicator" d={d} />
      </svg>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            btns.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === idx}
          aria-label={o["aria-label"]}
          tabIndex={i === idx ? 0 : -1}
          className="at-seg-option"
          data-selected={i === idx || undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
