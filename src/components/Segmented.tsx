import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { capHalf, clamp, gaussian, profilePath, samples } from "../core/geometry";
import { isKeyboardModality, useAnimated, useLatest, useSize } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";
import type { ControlSize } from "../tokens/tokens";

export type SegmentedOption<V extends string> = { value: V; label: ReactNode; "aria-label"?: string };

export type SegmentedProps<V extends string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (v: V) => void;
  size?: ControlSize;
  fullWidth?: boolean;
  "aria-label"?: string;
  feel?: Partial<ResolvedFeel<"segmented">>;
};

const INSET = 2;

/**
 * Segmented Control — 液体一样从一格流向另一格的选中底色 (Handoff §5.7)
 * Leading and trailing edges travel independently; both surfaces share a crest.
 */
export function Segmented<V extends string>({ options, value, onChange, size = "md", fullWidth, feel: local, ...aria }: SegmentedProps<V>) {
  const { p, t, deform, reduced } = useFeel("segmented", local);
  const [ref, box] = useSize<HTMLDivElement>();
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const L = useAnimated(0);
  const R = useAnimated(0);
  const bulge = useAnimated(0);
  const bulgeX = useAnimated(0);
  const bulgeW = useAnimated(40);
  const hovering = useRef(false);
  const target = useRef({ l: 0, r: 0 });
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
    if (!inited.current || box.width === 0) {
      L.set(m.l);
      R.set(m.r);
      target.current = m;
      if (box.width > 0) inited.current = true;
      return;
    }
    const prev = target.current;
    if (prev.l === m.l && prev.r === m.r) return;
    const curL = L.mv.get();
    const curR = R.mv.get();
    target.current = m;
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
  const bump = (x: number, amount: number, centre: number, width: number) => p.bulgeHeight * deform * amount * gaussian(x - centre, Math.max(8, width * 0.28));
  const edgeGate = (x: number, left: number, right: number) => {
    const u = clamp(Math.min(x - left, right - x) / Math.max(1, Math.min(12, (right - left) / 2)), 0, 1);
    return u * u * (3 - 2 * u);
  };
  // A single crest in container coordinates: sliding the selection only moves
  // its rounded ends, never changes its height or pinches the shared contour.
  const lift = (x: number, amount: number, centre: number, width: number) =>
    bump(x, amount, centre, width) * edgeGate(x, 0.5, box.width - 0.5);
  const contour = (x: number, left: number, right: number, half: number, amount: number, centre: number, width: number) =>
    capHalf(x, left, right, half, half) * (1 + lift(x, amount, centre, width) / Math.max(1, half));
  const trackD = useTransform([bulge.mv, bulgeX.mv, bulgeW.mv] as const, ([amount, centre, width]: number[]) => {
    if (!box.width) return "";
    const half = Math.max(0, cy - 0.5);
    return profilePath(samples(0.5, box.width - 0.5, cy + 1, 1), x =>
      contour(x, 0.5, box.width - 0.5, half, amount, centre, width), () => cy);
  });
  const d = useTransform([L.mv, R.mv, bulge.mv, bulgeX.mv, bulgeW.mv] as const, ([l, r, amount, centre, width]: number[]) => {
    if (box.width === 0 || r - l <= 0) return "";
    // Spring overshoot must not push the selected surface through the padding.
    l = clamp(l, INSET, box.width - INSET);
    r = clamp(r, l, box.width - INSET);
    const half = h / 2;
    const hf = (x: number) => contour(x, l, r, half, amount, centre, width);
    return profilePath(samples(l, r, half + 1, 1), hf, () => cy);
  });

  const hoverOption = (i: number) => {
    const m = measure(i);
    if (!m) return;
    const centre = (m.l + m.r) / 2;
    if (!hovering.current && bulge.mv.get() < 0.01) { bulgeX.set(centre); bulgeW.set(m.r - m.l); }
    else { bulgeX.to(centre, t(p.headSpring)); bulgeW.to(m.r - m.l, t(p.headSpring)); }
    hovering.current = true;
    bulge.to(1, t(p.hoverSpring));
  };
  const leave = () => { hovering.current = false; bulge.to(0, t(p.hoverSpring, { exit: true })); };
  const choose = (i: number) => {
    onChange(options[i].value);
    // Do not recreate the bump on click: let the existing crest linger as
    // the selected surface arrives, then settle even while the pointer stays.
    bulge.to(0, { duration: reduced ? 0 : p.lingerDuration / 1000, ease: [0.4, 0, 0.2, 1] });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir || !options.length) return;
    e.preventDefault();
    const n = (idx + dir + options.length) % options.length;
    btns.current[n]?.focus();
    choose(n);
  };

  return (
    <div
      ref={ref}
      className="at-seg"
      role="radiogroup"
      aria-label={aria["aria-label"]}
      data-size={size}
      data-control-size={size}
      data-full={fullWidth || undefined}
      data-at-interactive
      onKeyDown={onKeyDown}
      onPointerLeave={leave}
    >
      <svg className="at-seg-svg" width={Math.max(1, box.width)} height={Math.max(1, box.height)} aria-hidden>
        <motion.path className="at-seg-track" d={trackD} />
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
          onPointerEnter={() => hoverOption(i)}
          onFocus={() => { if (isKeyboardModality()) hoverOption(i); }}
          onBlur={leave}
          onClick={() => choose(i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
