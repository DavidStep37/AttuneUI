import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { motion, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { clamp, decimals, roundTo } from "../core/geometry";
import { useAnimated, useLatest, useSize } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";
import { ValueRoll } from "./ValueRoll";
import { controlHeight, type ControlSize } from "../tokens/tokens";

export type NumberInputProps = {
  size?: ControlSize;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** decimals shown; defaults to the step's decimals */
  precision?: number;
  unit?: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /** minimum number of characters reserved for the number */
  minChars?: number;
  feel?: Partial<ResolvedFeel<"input">>;
};

const format = (v: number, precision: number) => v.toFixed(precision);

/**
 * Input — the underline traces outward, up the sides, then closes above the
 * centred number. Units occupy their own column and never displace the digits.
 */
export function NumberInput({
  size = "md",
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision,
  unit,
  disabled,
  className,
  minChars = 2,
  feel: local,
  ...aria
}: NumberInputProps) {
  const { p, deform, reduced } = useFeel("input", local);
  const prec = precision ?? decimals(step);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const draw = useAnimated(0);
  const grow = useAnimated(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [boxRef, boxSize] = useSize<HTMLDivElement>();
  const initialDraft = useRef<string | null>(null);
  const expanded = !disabled && (editing || focused);
  const outlined = !disabled && (hover || expanded);
  const animateDraw = draw.to;
  const drawProgress = draw.mv;
  const animateGrow = grow.to;
  // Drawing a border is not spring recovery. Saved global/legacy spring times
  // can be as short as 20ms, which used to collapse both stages into a snap.
  const drawSeconds = clamp(Number.isFinite(p.drawDuration) ? p.drawDuration : 300, 100, 4000) / 1000;
  const expandSeconds = clamp(Number.isFinite(p.expandDuration) ? p.expandDuration : 480, 300, 1000) / 1000;

  useEffect(() => {
    // Hover draws a compact enclosure. Clicking during the trace continues it
    // from its current position; focus never restarts or completes it abruptly.
    const target = outlined ? 1 : 0;
    animateDraw(target, reduced ? { duration: 0 } : {
      type: "tween",
      duration: drawSeconds * (outlined ? 1 : 0.56) * Math.abs(target - drawProgress.get()),
      ease: [0.3, 0, 0.7, 1],
    });
  }, [outlined, reduced, drawSeconds, animateDraw, drawProgress]);

  useEffect(() => {
    const resize = () => animateGrow(expanded ? 1 : 0, reduced ? { duration: 0 } : {
      type: "tween",
      duration: expandSeconds,
      ease: [0.4, 0, 0.2, 1],
    });
    // Focus the editor immediately, but finish tracing the small rectangle
    // before growing it. A quick click must not move the line being drawn.
    if (!expanded || reduced || drawProgress.get() >= 1) {
      resize();
      return;
    }
    const unsubscribe = drawProgress.on("change", value => {
      if (value >= 1) {
        unsubscribe();
        resize();
      }
    });
    return unsubscribe;
  }, [expanded, reduced, expandSeconds, animateGrow, drawProgress]);

  const amount = p.expand * Math.min(1, deform || 0);
  const inset = useTransform(grow.mv, (g) => -g * amount);
  // Reserve the unit's travel in layout so drawing the frame cannot move digits.
  // The horizontal enclosure includes its 1px stroke: a 4px gap becomes 3px.
  const inlineInset = useTransform(grow.mv, (g) => -g * (amount + 1));
  const unitX = useTransform(grow.mv, (g) => g * amount);
  const surfaceProgress = useTransform(grow.mv, (g) => clamp(g, 0, 1));
  // No full-rectangle fill/shadow can pop in during the final stroke segment.
  // The surface fades in throughout the subsequent focus expansion instead.
  const surfaceOpacity = useTransform(grow.mv, g => clamp(g, 0, 1));
  const outline = (g: number, d: number) => {
    const extra = clamp(g, 0, 1) * amount;
    const w = (boxSize.width || 44) + extra * 2 + clamp(g, 0, 1) * 2;
    const h = (boxSize.height || controlHeight(size) - 4) + extra * 2;
    const x = 0.5, y = 0.5, right = w - 0.5, bottom = h - 0.5;
    const r = Math.min(5, (w - 1) / 2, (h - 1) / 2);
    const leftPath = `M${w / 2} ${bottom}H${x + r}A${r} ${r} 0 0 1 ${x} ${bottom - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}H${w / 2}`;
    const rightPath = `M${w / 2} ${bottom}H${right - r}A${r} ${r} 0 0 0 ${right} ${bottom - r}V${y + r}A${r} ${r} 0 0 0 ${right - r} ${y}H${w / 2}`;
    const halfPerimeter = w + h - 2 - 4 * r + Math.PI * r;
    const initialFraction = Math.min(10, (w - 1) / 2 - r) / halfPerimeter;
    return { leftPath, rightPath, offset: (1 - initialFraction) * (1 - clamp(d, 0, 1)) };
  };
  // Subscribe directly to the shared progress, avoiding an extra derived-value
  // frame between the container expansion and its SVG coordinates.
  const leftOutline = useTransform(() => outline(grow.mv.get(), draw.mv.get()).leftPath);
  const rightOutline = useTransform(() => outline(grow.mv.get(), draw.mv.get()).rightPath);
  const outlineOffset = useTransform(() => outline(grow.mv.get(), draw.mv.get()).offset);

  const commit = (text: string) => {
    const n = parseFloat(text.replace(/[^\d.+-eE]/g, ""));
    if (!Number.isNaN(n)) onChange(clamp(roundTo(n, step), min, max));
  };

  const startEdit = (initial?: string) => {
    if (disabled) return;
    initialDraft.current = initial ?? null;
    setDraft(initial ?? format(value, prec));
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (initialDraft.current === null) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const nudge = (e: KeyboardEvent, base: number) => {
    const k = step * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);
    const dir = e.key === "ArrowUp" ? 1 : -1;
    return clamp(roundTo(base + dir * k, e.altKey ? step / 10 : step), min, max);
  };

  const onDisplayKey = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(nudge(e, value));
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEdit();
    } else if (/^[\d.-]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      startEdit(e.key);
    }
  };

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(draft);
      setEditing(false);
      requestAnimationFrame(() => boxRef.current?.focus({ preventScroll: true }));
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setEditing(false);
      requestAnimationFrame(() => boxRef.current?.focus({ preventScroll: true }));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const base = parseFloat(draft);
      const next = nudge(e, Number.isNaN(base) ? value : base);
      setDraft(format(next, prec));
      onChange(next);
    }
  };

  const text = editing ? draft : format(value, prec);
  const chars = Math.max(minChars, text.length);

  return (
    <div
      className={`at-input ${className ?? ""}`}
      data-control-size={size}
      data-at-interactive
      data-editing={editing || undefined}
      data-focused={focused || undefined}
      data-hover={hover || undefined}
      data-disabled={disabled || undefined}
      style={{ paddingRight: amount, ["--at-input-bgshift" as string]: String(p.bgShift), ["--at-input-highlight" as string]: String(p.highlight) }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div
        ref={boxRef}
        className="at-input-box"
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        role="spinbutton"
        tabIndex={editing || disabled ? -1 : 0}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-label={aria["aria-label"]}
        onKeyDown={editing ? undefined : onDisplayKey}
        onClick={() => !editing && startEdit()}
      >
        <motion.span className="at-input-frame" style={{ top: inset, left: inlineInset, right: inlineInset, bottom: inset, ["--at-input-progress" as string]: surfaceProgress, ["--at-input-draw" as string]: draw.mv }} aria-hidden>
          <motion.span className="at-input-surface" style={{ opacity: surfaceOpacity }} />
          <svg className="at-input-outline" width="100%" height="100%">
            <motion.path d={leftOutline} pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: outlineOffset }} />
            <motion.path d={rightOutline} pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: outlineOffset }} />
          </svg>
        </motion.span>
        <span className="at-input-value" style={{ minWidth: `${chars}ch` }}>
          {editing ? (
            <>
              <span className="at-input-measure" aria-hidden>
                {draft || " "}
              </span>
              <input
                ref={inputRef}
                className="at-input-field"
                value={draft}
                inputMode="decimal"
                aria-label={aria["aria-label"]}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onEditKey}
                onBlur={() => {
                  commit(draft);
                  setEditing(false);
                }}
              />
            </>
          ) : (
            <ValueRoll value={value} text={text} />
          )}
        </span>
      </div>
      <motion.span className="at-input-unit" style={{ x: unitX }} aria-hidden={unit === undefined || undefined}>
        {unit}
      </motion.span>
    </div>
  );
}

/**
 * Drag a label horizontally to scrub a value (拖动标签调值).
 * Shift = ×10, Alt = ×0.1.
 */
export function useScrub(opts: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const { p } = useFeel("input");
  const o = useLatest({ ...opts, sensitivity: p.scrubSensitivity });
  const st = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (o.current.disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    st.current = { x: e.clientX, v: o.current.value, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = st.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) < 2) return;
    if (!s.moved) {
      s.moved = true;
      setScrubbing(true);
      document.documentElement.dataset.atScrubbing = "true";
    }
    const { step = 1, min = -Infinity, max = Infinity, sensitivity } = o.current;
    const mul = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const q = e.altKey ? step / 10 : step;
    const next = clamp(roundTo(s.v + dx * sensitivity * step * mul, q), min, max);
    if (next !== o.current.value) o.current.onChange(next);
  };
  const end = () => {
    st.current = null;
    setScrubbing(false);
    delete document.documentElement.dataset.atScrubbing;
  };
  return {
    scrubbing,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
  };
}
