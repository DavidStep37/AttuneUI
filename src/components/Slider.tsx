import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useAnimationFrame, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { clamp, snapSliderValue, rubber, nestedSlider, SLIDER_DOT, SLIDER_INNER_HALF } from "../core/geometry";
import { isKeyboardModality, useAnimated, useLatest, useSize } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";
import { controlHeight, type ControlSize } from "../tokens/tokens";

export const SLIDER_THUMB = { w: SLIDER_DOT, h: SLIDER_DOT };
const THUMB_HIT_RADIUS = 12;

export type SliderProps = {
  size?: ControlSize;
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
  size = "md",
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
  const HEIGHT = controlHeight(size);
  const { p, deform, t } = useFeel("slider", local);
  const [ref, { width: W }] = useSize<HTMLDivElement>();
  const pad = Math.max(1, p.edgePadding);
  const margin = Math.min(SLIDER_INNER_HALF + pad, W / 2);
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
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [keyFocus, setKeyFocus] = useState(false);
  const [active, setActive] = useState(false);
  const onChangeRef = useLatest(onChange);
  const geo = useLatest({ margin, span, W, min, max, step });

  const emit = useCallback(
    (f: number) => {
      const g = geo.current;
      const v = snapSliderValue(g.min + f * (g.max - g.min), g.min, g.max, g.step);
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
  const bulging = !disabled && (hoverThumb || active || keyFocus);
  useEffect(() => {
    hover.to(bulging ? 1 : 0, bulging ? t(p.thumbSpring) : t(p.recover));
  }, [bulging, deform, p.thumbSpring, p.recover, t]);

  const shape = useTransform(
    [frac.mv, hover.mv, stretchL.mv, stretchR.mv, vel] as const,
    ([f, h, sl, sr, v]: number[]) => {
      if (W <= 0) return null;
      return nestedSlider({
        width: W, progress: f, focus: h, deform, velocity: v, gap: pad,
        thumbHoverScale: p.thumbHoverScale, bulgeHeight: p.bulgeHeight,
        bulgeWidth: p.bulgeWidth, endInset: p.endInset,
        neckDepth: p.neckDepth, trail: p.trail,
        stretchL: sl, stretchR: sr,
      });
    },
  );
  const d = useTransform(shape, (s) => s?.outerPath ?? "");
  const fillD = useTransform(shape, (s) => s?.fillPath ?? "");
  const thumbX = useTransform(shape, (s) => s ? s.cx - s.thumbW / 2 : 0);
  const thumbY = useTransform(shape, (s) => (HEIGHT - (s?.thumbH ?? SLIDER_DOT)) / 2);
  const thumbW = useTransform(shape, (s) => s?.thumbW ?? SLIDER_DOT);
  const thumbH = useTransform(shape, (s) => s?.thumbH ?? SLIDER_DOT);
  const thumbR = useTransform(thumbH, h => h / 2);

  /* ---------------------------------------------------------- pointer */

  const localX = (e: PointerEvent) => e.clientX - (ref.current?.getBoundingClientRect().left ?? 0);
  const thumbCx = () => margin + frac.mv.get() * span;
  const nearThumb = (x: number, y: number) => Math.hypot(x - thumbCx(), y - HEIGHT / 2) <= THUMB_HIT_RADIUS;
  const updatePointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    pointer.current = rect && e.pointerType !== "touch" ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null;
    const point = pointer.current;
    setHoverThumb(!!point && nearThumb(point.x, point.y));
  };
  // Track clicks/external updates can move the handle under a stationary cursor.
  useMotionValueEvent(frac.mv, "change", () => {
    const point = pointer.current;
    if (point) setHoverThumb(nearThumb(point.x, point.y));
  });

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
    updatePointer(e);
    setActive(true);
    setKeyFocus(false);
    ref.current?.querySelector<HTMLElement>(".at-slider-thumb")?.focus({ preventScroll: true });
    const y = e.clientY - (ref.current?.getBoundingClientRect().top ?? 0);
    if (nearThumb(x, y)) {
      mode.current = "drag";
      drag.current = { grab: x - cx, startX: x };
    } else {
      mode.current = "press";
      drag.current = { grab: 0, startX: x };
      const f = clamp((x - margin) / span, 0, 1);
      emit(f);
      frac.to(toFrac(lastEmitted.current), t(p.thumbSpring));
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    updatePointer(e);
    const x = localX(e);
    if (!mode.current) return;
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
    if (e.type === "pointercancel" || e.type === "lostpointercapture" || e.pointerType === "touch") {
      pointer.current = null;
      setHoverTrack(false);
      setHoverThumb(false);
    } else updatePointer(e);
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
    const v = snapSliderValue(next, min, max, step);
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
      data-control-size={size}
      data-at-interactive
      data-hover={hoverTrack || undefined}
      data-active={active || undefined}
      data-disabled={disabled || undefined}
      style={{ height: HEIGHT }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onPointerEnter={(e) => {
        setHoverTrack(e.pointerType !== "touch");
        updatePointer(e);
      }}
      onPointerLeave={() => {
        pointer.current = null;
        setHoverTrack(false);
        setHoverThumb(false);
      }}
    >
      <svg className="at-slider-svg" width={Math.max(W, 1)} height={HEIGHT} aria-hidden>
        <g transform={`translate(0 ${(HEIGHT - 28) / 2})`}>
        <motion.path className="at-slider-track" d={d} />
        <motion.path className="at-slider-fill" d={fillD} />
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
