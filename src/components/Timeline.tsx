import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { useFeel, type FeelRuntime } from "../core/feel";
import { capHalf, clamp, gaussian, profilePath, roundTo, samples } from "../core/geometry";
import { useAnimated, useSize } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";

export type TimelineItem = {
  id: string;
  label: string;
  delay: number;
  duration: number;
  movable?: boolean;
  resizable?: boolean;
};

export type TimelineChange = { delay: number; duration: number };

export type TimelineProps = {
  items: TimelineItem[];
  onChange?: (id: string, next: TimelineChange) => void;
  onChangeEnd?: (id: string) => void;
  step?: number;
  minDuration?: number;
  /** fixed visible range in ms; auto when omitted */
  range?: number;
  /** playback position in ms */
  playhead?: MotionValue<number>;
  rowHeight?: number;
  labelWidth?: number;
  unit?: string;
  "aria-label"?: string;
  feel?: Partial<ResolvedFeel<"timeline">>;
};


function niceCeil(v: number) {
  const steps = [100, 200, 250, 500, 1000, 2000, 2500, 5000];
  for (const s of steps) if (v <= s * 6) return Math.ceil(v / s) * s;
  return Math.ceil(v / 10000) * 10000;
}
function tickStep(range: number, count: number) {
  const target = range / count;
  const opts = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  return opts.find((o) => o >= target) ?? 10000;
}

/**
 * Timeline — 被绷直的弹力带 (Handoff §5.3)
 */
export function Timeline({
  items,
  onChange,
  onChangeEnd,
  step = 10,
  minDuration = 20,
  range,
  playhead,
  rowHeight = 24,
  labelWidth = 44,
  unit = "ms",
  feel: local,
  ...aria
}: TimelineProps) {
  const feel = useFeel("timeline", local);
  const [trackRef, { width: TW }] = useSize<HTMLDivElement>();
  const [dragging, setDragging] = useState<string | null>(null);
  const frozen = useRef<number | null>(null);

  const auto = useMemo(() => niceCeil(Math.max(400, ...items.map((i) => (i.delay + i.duration) * 1.12))), [items]);
  // Linked items can grow beyond the range captured at pointer-down. Grow the
  // viewport to fit all items; do not shrink it again until the drag ends.
  const R = range ?? Math.max(dragging ? frozen.current ?? 0 : 0, auto);
  useLayoutEffect(() => {
    if (dragging) frozen.current = R;
  }, [dragging, R]);
  const inset = Math.min(feel.p.edgePadding, TW / 4);
  const scale = TW > 0 ? (TW - inset * 2) / R : 0;
  const ts = tickStep(R, Math.max(1, Math.min(6, Math.floor(TW / 64))));
  const ticks: number[] = [];
  for (let v = 0; v <= R + 1e-6; v += ts) ticks.push(v);

  const fallback = useMotionValue(0);
  const ph = playhead ?? fallback;
  const phX = useTransform(ph, (v: number) => inset + v * scale);
  const phOpacity = useTransform(ph, (v: number) => (v > 0 && v < R ? 1 : 0));

  return (
    <div className="at-tl" data-at-interactive role="group" aria-label={aria["aria-label"]} style={{ ["--at-tl-label" as string]: `${labelWidth}px` }}>
      <div className="at-tl-axis">
        <span className="at-tl-axis-unit">{unit}</span>
        <div className="at-tl-axis-track">
          {ticks.map((v) => (
            <span key={v} className="at-tl-tick" style={{ left: inset + v * scale }}>
              {v}
            </span>
          ))}
        </div>
      </div>
      <div className="at-tl-body">
        <div className="at-tl-labels">
          {items.map((it) => (
            <div key={it.id} className="at-tl-label" style={{ height: rowHeight }}>
              {it.label}
            </div>
          ))}
        </div>
        <div className="at-tl-track" ref={trackRef}>
          <div className="at-tl-grid-clip" aria-hidden>
            {ticks.filter((v) => v > 0 && v < R).map((v) => (
              <span key={v} className="at-tl-grid" style={{ left: inset + v * scale }} />
            ))}
          </div>
          {items.map((it) => (
            <Bar
              key={it.id}
              item={it}
              scale={scale}
              rowHeight={rowHeight}
              width={TW}
              inset={inset}
              limit={range}
              step={step}
              minDuration={minDuration}
              feel={feel}
              suppressPluck={!!dragging}
              unit={unit}
              onDragStart={() => {
                frozen.current = R;
                setDragging(it.id);
              }}
              onDragEnd={() => {
                setDragging(null);
                frozen.current = null;
                onChangeEnd?.(it.id);
              }}
              onChange={(next) => onChange?.(it.id, next)}
            />
          ))}
          {playhead && <motion.span className="at-tl-playhead" style={{ x: phX, opacity: phOpacity }} aria-hidden />}
        </div>
      </div>
    </div>
  );
}

type BarProps = {
  item: TimelineItem;
  scale: number;
  rowHeight: number;
  width: number;
  inset: number;
  limit?: number;
  step: number;
  minDuration: number;
  feel: FeelRuntime<"timeline">;
  suppressPluck: boolean;
  unit: string;
  onChange: (n: TimelineChange) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

type Mode = "move" | "left" | "right";

function Bar({ item, scale, rowHeight, width, inset, limit, step, minDuration, feel, suppressPluck, unit, onChange, onDragStart, onDragEnd }: BarProps) {
  const { p, t, deform, passive } = feel;
  const thin = useAnimated(1);
  const press = useAnimated(0);
  const pluck = useAnimated(0);
  const pluckAt = useRef({ x: 0, dir: 1, amp: 0 });
  // Bars fill the lane, leaving the Slider's shell gap to the lane edges (外壳包裹内芯).
  const BAR_H = Math.max(6, rowHeight - 2 * p.barInset);
  const swell = useAnimated(0);
  const swellX = useAnimated(0);
  const drag = useRef<{ mode: Mode; x: number; delay: number; duration: number; scale: number } | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [hover, setHover] = useState(false);
  const movable = item.movable !== false;
  const resizable = item.resizable !== false;

  const x0 = inset + item.delay * scale;
  const x1 = inset + (item.delay + item.duration) * scale;
  const cy = rowHeight / 2;

  const d = useTransform([thin.mv, press.mv, pluck.mv, swell.mv, swellX.mv] as const, ([f, pr, pl, sw, sx]: number[]) => {
    if (scale <= 0) return "";
    const spread = p.pressSpread * pr * deform;
    const X0 = clamp(x0 - spread, inset, width - inset);
    const X1 = clamp(x1 + spread, X0, width - inset);
    const len = Math.max(1, X1 - X0);
    const half0 = BAR_H / 2 + spread * 0.5;
    const { x: px, dir, amp } = pluckAt.current;
    const sig = Math.max(12, len * 0.35);
    // Hover swell: around the pointer the bar pushes back toward the lane edge.
    const swellAmp = p.bulge * sw * deform;
    const swellSig = Math.max(6, BAR_H * p.bulgeWidth);
    const body = (x: number) => {
      const u = clamp((x - X0) / len, 0, 1);
      return half0 * (1 + (f - 1) * Math.sin(Math.PI * u)) + swellAmp * gaussian(x - sx, swellSig);
    };
    const half = (x: number) => capHalf(x, X0, X1, body(x), BAR_H / 2);
    const cyf = (x: number) => {
      if (!pl) return cy;
      const u = clamp((x - X0) / len, 0, 1);
      return cy + pl * amp * dir * Math.sin(Math.PI * u) * gaussian(x - px, sig);
    };
    return profilePath(samples(X0, X1, BAR_H / 2 + 1, 1.5), half, cyf);
  });
  const filter = useTransform(press.mv, (v) => (v > 0.01 ? `brightness(${1 - p.pressDarken * v})` : "none"));

  const localX = (e: PointerEvent<HTMLDivElement>) => e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left;

  const doPluck = (e: PointerEvent<HTMLDivElement>) => {
    if (suppressPluck || e.buttons !== 0 || !deform) return;
    const rect = e.currentTarget.parentElement!.getBoundingClientRect();
    const intensity = clamp(Math.abs(e.movementY) / 4, 0.5, 1);
    pluckAt.current = {
      x: e.clientX - rect.left,
      dir: e.movementY < 0 ? -1 : 1,
      amp: p.pluckAmp * passive * deform * intensity,
    };
    pluck.to(1, { duration: 0.05, ease: "easeOut" } as never);
    setTimeout(() => pluck.to(0, t(p.pluckSpring)), 50);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, m: Mode) => {
    if (e.button !== 0) return;
    if (m === "move" && !movable) return;
    if (m !== "move" && !resizable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget.closest(".at-tl-hit") as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget.closest(".at-tl-hit") as HTMLElement).focus({ preventScroll: true });
    drag.current = { mode: m, x: e.clientX, delay: item.delay, duration: item.duration, scale };
    setMode(m);
    onDragStart();
    pluck.set(0);
    if (m === "move") press.to(1, t(p.recover));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = drag.current;
    if (!s || s.scale <= 0) return;
    // Keep ms-per-pixel stable even when linked rows expand the visible range.
    const dms = (e.clientX - s.x) / s.scale;
    let delay = s.delay;
    let duration = s.duration;
    if (s.mode === "move") delay = clamp(roundTo(s.delay + dms, step), 0, Math.max(0, (limit ?? Infinity) - duration));
    else if (s.mode === "right") {
      const maxDuration = Math.max(0, (limit ?? Infinity) - delay);
      duration = clamp(roundTo(s.duration + dms, step), Math.min(minDuration, maxDuration), maxDuration);
    }
    else {
      const end = s.delay + s.duration;
      delay = clamp(roundTo(s.delay + dms, step), 0, end - minDuration);
      duration = end - delay;
    }
    if (s.mode !== "move") {
      const ratio = duration / s.duration;
      // lengthen → thinner middle, shorten → thicker (体积守恒)
      thin.set(clamp(Math.pow(ratio, -0.5 * p.stretchThin * deform), 0.5, 1.6));
    }
    if (delay !== item.delay || duration !== item.duration) onChange({ delay, duration });
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setMode(null);
    thin.to(1, t(p.recover));
    press.to(0, t(p.recover));
    onDragEnd();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const k = step * (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" ? -1 : 1);
    if (e.altKey && resizable) {
      const maxDuration = Math.max(0, (limit ?? Infinity) - item.delay);
      onChange({ delay: item.delay, duration: clamp(item.duration + k, Math.min(minDuration, maxDuration), maxDuration) });
    } else if (movable) onChange({ delay: clamp(item.delay + k, 0, Math.max(0, (limit ?? Infinity) - item.duration)), duration: item.duration });
  };

  const hitW = Math.max(8, x1 - x0);
  const edgeW = Math.min(8, Math.max(4, (x1 - x0) / 4));

  return (
    <div className="at-tl-row" data-active={mode ? true : undefined} style={{ height: rowHeight }}>
      <svg className="at-tl-svg" width={Math.max(1, width)} height={rowHeight} aria-hidden>
        <motion.path className="at-tl-bar" d={d} style={{ filter }} data-active={mode ? true : undefined} data-hover={hover || undefined} />
      </svg>
      <div
        className="at-tl-hit"
        tabIndex={0}
        role="slider"
        aria-label={`${item.label}：延迟 ${item.delay}${unit}，时长 ${item.duration}${unit}`}
        aria-valuenow={item.delay}
        data-mode={mode ?? undefined}
        style={{ left: x0, width: hitW, top: 0, height: rowHeight }}
        onPointerEnter={(e) => {
          setHover(true);
          doPluck(e);
          swellX.set(localX(e));
          swell.to(1, t(p.recover));
        }}
        onPointerLeave={() => {
          setHover(false);
          swell.to(0, t(p.recover, { exit: true }));
        }}
        onPointerMove={(e) => {
          swellX.to(localX(e), drag.current ? { duration: 0 } : t(p.recover));
          onPointerMove(e);
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div className="at-tl-hit-body" data-movable={movable || undefined} onPointerDown={(e) => onPointerDown(e, "move")} />
        {resizable && (
          <>
            <div className="at-tl-hit-edge" data-side="left" style={{ width: edgeW }} onPointerDown={(e) => onPointerDown(e, "left")} />
            <div className="at-tl-hit-edge" data-side="right" style={{ width: edgeW }} onPointerDown={(e) => onPointerDown(e, "right")} />
          </>
        )}
      </div>
      {mode && (
        <RangeReadout item={item} unit={unit} x={x0} top={cy - 10} width={width} />
      )}
    </div>
  );
}

function RangeReadout({ item, unit, x, top, width }: { item: TimelineItem; unit: string; x: number; top: number; width: number }) {
  const [ref, size] = useSize<HTMLDivElement>();
  return (
    <div ref={ref} className="at-tl-readout" style={{ left: clamp(x, 1, Math.max(1, width - size.width - 1)), top, maxWidth: Math.max(0, width - 2) }}>
      {item.delay}<span>–</span>{item.delay + item.duration}<em>{unit}</em>
    </div>
  );
}
