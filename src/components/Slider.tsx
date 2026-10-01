import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useAnimationFrame, useMotionValue, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { clamp, roundTo, rubber, softTrack } from "../core/geometry";
import { isKeyboardModality, useAnimated, useLatest, useSize } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";

export const SLIDER_THUMB = { w: 10, h: 14 };
const HEIGHT = 28;

export type SliderProps = {
  value: number;
  onChange: (v: number) => void;
  onChangeEnd?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-valuetext"?: string;
  feel?: Partial<ResolvedFeel<"slider">>;
};

/**
 * Slider — 刚性物体将软性物体撑开 (Handoff §5.1)
 * operating object: thumb · responding objects: track, ends, value readout
 */
export function Slider({
  value,
  onChange,
  onChangeEnd,
  min = 0,
  max = 1,
  step = 0.01,
  disabled,
  className,
  feel: local,
  ...aria
}: SliderProps) {
  const { p, deform, t } = useFeel("slider", local);
  const [ref, { width: W }] = useSize<HTMLDivElement>();
  const clipId = useId().replace(/:/g, "");

  const pad = p.edgePadding;
  const baseHalf = SLIDER_THUMB.h / 2 + pad;
  const margin = pad + SLIDER_THUMB.w / 2;
  const span = Math.max(1, W - margin * 2);

  const toFrac = useCallback((v: number) => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1)), [min, max]);
  const frac = useAnimated(toFrac(value));
  const hover = useAnimated(0);
  const stretchL = useAnimated(0);
  const stretchR = useAnimated(0);

  const lastEmitted = useRef(value);
  const mode = useRef<null | "press" | "drag">(null);
  const drag = useRef({ grab: 0, startX: 0 });
  const [hoverTrack, setHoverTrack] = useState(false);
  const [hoverThumb, setHoverThumb] = useState(false);
  const [keyFocus, setKeyFocus] = useState(false);
  const [active, setActive] = useState(false);
  const onChangeRef = useLatest(onChange);
  const geo = useLatest({ margin, span, W, min, max, step });

  const emit = useCallback(
    (f: number) => {
      const g = geo.current;
      const v = clamp(roundTo(g.min + f * (g.max - g.min), g.step), g.min, g.max);
      if (v !== lastEmitted.current) {
        lastEmitted.current = v;
        onChangeRef.current(v);
      }
      return v;
    },
    [geo, onChangeRef],
  );

  // Bulge centre is locked to the thumb. Only the trail *shape* reacts to speed:
  // velocity is smoothed with spring.follow's time constant, so the asymmetry
  // eases in/out without making the bulge lag behind.
  const vel = useMotionValue(0);
  const spanRef = useLatest(span);
  const followRef = useLatest(p.follow.visualDuration);
  useAnimationFrame((_, dt) => {
    const target = frac.mv.getVelocity() * spanRef.current;
    const cur = vel.get();
    if (target === 0 && cur === 0) return;
    const tau = Math.max(0.008, followRef.current / 3);
    const k = 1 - Math.exp(-dt / 1000 / tau);
    let next = cur + (target - cur) * k;
    if (Math.abs(next) < 2 && target === 0) next = 0;
    if (next !== cur) vel.set(next);
  });

  // external value → animate thumb
  useEffect(() => {
    if (mode.current) return;
    if (value === lastEmitted.current && Math.abs(toFrac(value) - frac.mv.get()) < 1e-6) return;
    lastEmitted.current = value;
    frac.to(toFrac(value), t(p.thumbSpring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, toFrac]);

  // hover / bulge amount
  const bulging = hoverThumb || active || keyFocus;
  useEffect(() => {
    hover.to(bulging ? 1 : 0, bulging ? t(p.thumbSpring) : t(p.recover));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulging]);

  const shape = useTransform(
    [frac.mv, hover.mv, stretchL.mv, stretchR.mv, vel] as const,
    ([f, h, sl, sr, v]: number[]) => {
      if (W <= 0) return null;
      const sc = 1 + (p.thumbHoverScale - 1) * h * Math.min(1, deform);
      const cx = margin + f * span;
      // past an extreme the thumb itself stretches toward the pull (体积守恒: a little thinner)
      const w0 = SLIDER_THUMB.w * sc;
      const stretch = sl + sr;
      const tw = w0 + stretch;
      const th = SLIDER_THUMB.h * sc * (1 - 0.3 * p.endShrink * Math.min(1, stretch / (w0 * 2)));
      const tx0 = cx - w0 / 2 - sl;
      const tx1 = cx + w0 / 2 + sr;
      const tc = (tx0 + tx1) / 2;
      const speed = Math.min(1, Math.abs(v) / 1500);
      const sigma = p.bulgeWidth * SLIDER_THUMB.w * 0.4;
      const trail = p.trail * speed * deform;
      const behind = sigma * (1 + trail * 2);
      const front = sigma * (1 - trail * 0.3);
      const bumpHalf = (p.bulgeHeight / 2) * h * deform;
      const res = softTrack({
        left: 0,
        right: W,
        cy: HEIGHT / 2,
        baseHalf,
        thumbX0: tx0,
        thumbX1: tx1,
        thumbHalfH: th / 2,
        thumbR: w0 / 2,
        bumpCx: tc,
        bumpHalf,
        sigmaL: v > 0 ? behind : front,
        sigmaR: v > 0 ? front : behind,
        shrinkHalf: bumpHalf * p.endShrink,
        thin: 1 - Math.min(0.2, (stretch / Math.max(1, W)) * 1.2),
      });
      // fill: empty at min, full at max, through the thumb centre in between
      const fillEnd = tc + (2 * f - 1) * (tw / 2 + res.clearance);
      return { d: res.d, x0: res.x0, fillEnd, tx0, tw, th, r: w0 / 2 };
    },
  );
  const d = useTransform(shape, (s) => s?.d ?? "");
  const fillX = useTransform(shape, (s) => (s ? s.x0 - 1 : 0));
  const fillW = useTransform(shape, (s) => (s ? Math.max(0, s.fillEnd - s.x0 + 1) : 0));
  const thumbX = useTransform(shape, (s) => s?.tx0 ?? 0);
  const thumbY = useTransform(shape, (s) => (s ? (HEIGHT - s.th) / 2 : (HEIGHT - SLIDER_THUMB.h) / 2));
  const thumbW = useTransform(shape, (s) => s?.tw ?? SLIDER_THUMB.w);
  const thumbH = useTransform(shape, (s) => s?.th ?? SLIDER_THUMB.h);
  const thumbR = useTransform(shape, (s) => s?.r ?? SLIDER_THUMB.w / 2);

  /* ---------------------------------------------------------- pointer */

  const localX = (e: PointerEvent) => e.clientX - (ref.current?.getBoundingClientRect().left ?? 0);
  const thumbCx = () => margin + frac.mv.get() * span;

  const dragTo = (x: number) => {
    const raw = x - drag.current.grab;
    const lo = margin;
    const hi = margin + span;
    const c = clamp(raw, lo, hi);
    const over = raw - c;
    const s = rubber(over, p.edgeResistance, p.maxStretch) * deform;
    stretchL.set(s < 0 ? -s : 0);
    stretchR.set(s > 0 ? s : 0);
    const f = (c - margin) / span;
    frac.set(f);
    emit(f);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const x = localX(e);
    const cx = thumbCx();
    setActive(true);
    ref.current?.querySelector<HTMLElement>(".at-slider-thumb")?.focus({ preventScroll: true });
    if (Math.abs(x - cx) <= SLIDER_THUMB.w / 2 + 5) {
      mode.current = "drag";
      drag.current = { grab: x - cx, startX: x };
    } else {
      mode.current = "press";
      drag.current = { grab: 0, startX: x };
      const f = clamp((x - margin) / span, 0, 1);
      frac.to(f, t(p.thumbSpring), (v) => emit(v));
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const x = localX(e);
    if (!mode.current) {
      setHoverThumb(Math.abs(x - thumbCx()) <= SLIDER_THUMB.w / 2 + 4);
      return;
    }
    if (mode.current === "press" && Math.abs(x - drag.current.startX) > 3) {
      frac.stop();
      mode.current = "drag";
      drag.current.grab = 0;
    }
    if (mode.current === "drag") dragTo(x);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!mode.current) return;
    const wasDrag = mode.current === "drag";
    mode.current = null;
    setActive(false);
    stretchL.to(0, t(p.recover));
    stretchR.to(0, t(p.recover));
    const v = wasDrag ? emit(frac.mv.get()) : lastEmitted.current;
    // settle onto the stepped position (吸附与归位)
    if (wasDrag) frac.to(toFrac(v), t(p.thumbSpring));
    const x = localX(e);
    setHoverThumb(Math.abs(x - margin - toFrac(v) * span) <= SLIDER_THUMB.w / 2 + 4 && e.type !== "pointercancel");
    onChangeEnd?.(v);
  };

  /* --------------------------------------------------------- keyboard */

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (!keyFocus) setKeyFocus(true);
    const big = e.shiftKey || e.key === "PageUp" || e.key === "PageDown";
    const k = step * (big ? 10 : 1);
    let next: number | null = null;
    const cur = lastEmitted.current;
    if (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp") next = cur + k;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown") next = cur - k;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    const dir = Math.sign(next - cur);
    const v = clamp(roundTo(next, step), min, max);
    if (v === cur && dir !== 0) {
      // pressing past the extreme → short stretch pulse (边界阻力)
      const target = dir < 0 ? stretchL : stretchR;
      target.set(p.maxStretch * 0.5 * deform);
      target.to(0, t(p.recover));
      return;
    }
    lastEmitted.current = v;
    frac.to(toFrac(v), t(p.thumbSpring));
    onChange(v);
    onChangeEnd?.(v);
  };

  return (
    <div
      ref={ref}
      className={`at-slider ${className ?? ""}`}
      data-at-interactive
      data-hover={hoverTrack || undefined}
      data-active={active || undefined}
      data-disabled={disabled || undefined}
      style={{ height: HEIGHT }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => setHoverTrack(true)}
      onPointerLeave={() => {
        setHoverTrack(false);
        if (!mode.current) setHoverThumb(false);
      }}
    >
      <svg className="at-slider-svg" width={Math.max(W, 1)} height={HEIGHT} aria-hidden>
        <defs>
          <clipPath id={clipId}>
            <motion.path d={d} />
          </clipPath>
        </defs>
        <motion.path className="at-slider-track" d={d} />
        <g clipPath={`url(#${clipId})`}>
          <motion.rect className="at-slider-fill" x={fillX} y={0} width={fillW} height={HEIGHT} />
        </g>
      </svg>
      <motion.div
        className="at-slider-thumb"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled}
        aria-label={aria["aria-label"]}
        aria-valuetext={aria["aria-valuetext"]}
        data-kbd={keyFocus || undefined}
        style={{ x: thumbX, y: thumbY, width: thumbW, height: thumbH, borderRadius: thumbR, top: 0 }}
        onKeyDown={onKeyDown}
        onFocus={() => setKeyFocus(isKeyboardModality())}
        onBlur={() => setKeyFocus(false)}
      />
    </div>
  );
}
