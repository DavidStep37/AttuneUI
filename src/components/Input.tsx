import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { motion, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { clamp, decimals, roundTo } from "../core/geometry";
import { useAnimated, useLatest } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";
import { ValueRoll } from "./ValueRoll";

export type NumberInputProps = {
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
 * Input — 袋口被撑开；被吹开的气泡 (Handoff §5.2)
 * Text and digits never move; only the frame expands. The unit may shift with the frame.
 */
export function NumberInput({
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
  const { p, t, deform } = useFeel("input", local);
  const prec = precision ?? decimals(step);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [hover, setHover] = useState(false);
  const grow = useAnimated(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const initialDraft = useRef<string | null>(null);

  useEffect(() => {
    grow.to(editing ? p.expand * Math.min(1, deform || 0) : 0, t(p.spring, { exit: !editing }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, p.expand, deform]);

  const inset = useTransform(grow.mv, (g) => -g);
  const unitX = useTransform(grow.mv, (g) => g);

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
      data-at-interactive
      data-editing={editing || undefined}
      data-hover={hover || undefined}
      data-disabled={disabled || undefined}
      style={{ ["--at-input-bgshift" as string]: String(p.bgShift), ["--at-input-highlight" as string]: String(p.highlight) }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div
        ref={boxRef}
        className="at-input-box"
        role="spinbutton"
        tabIndex={editing || disabled ? -1 : 0}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-label={aria["aria-label"]}
        onKeyDown={editing ? undefined : onDisplayKey}
        onClick={() => !editing && startEdit()}
      >
        <motion.span className="at-input-frame" style={{ top: inset, left: inset, right: inset, bottom: inset }} aria-hidden />
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
      {unit !== undefined && (
        <motion.span className="at-input-unit" style={{ x: unitX }}>
          {unit}
        </motion.span>
      )}
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
