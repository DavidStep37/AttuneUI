import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { springTransition, useFeelState } from "../core/feel";
import type { ParamDef, ParamValue } from "../core/schema";
import type { SpringToken } from "../tokens/tokens";
import { NumberInput, useScrub } from "./Input";
import { Slider } from "./Slider";

/* ------------------------------------------------------------------ Row */

export function Row({
  label,
  hint,
  modified,
  onReset,
  labelProps,
  children,
  stacked,
}: {
  label: ReactNode;
  hint?: ReactNode;
  modified?: boolean;
  onReset?: () => void;
  labelProps?: object;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className="at-row" data-stacked={stacked || undefined}>
      <span className="at-row-label" title={typeof hint === "string" ? hint : undefined} {...labelProps}>
        {modified && (
          <button
            type="button"
            className="at-row-modified"
            aria-label="已修改，点击重置"
            title="已修改 · 点击重置"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onReset?.();
            }}
          />
        )}
        <span className="at-row-label-text">{label}</span>
      </span>
      <div className="at-row-control">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------- SliderField */

export type SliderFieldProps = {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: ReactNode;
  modified?: boolean;
  onReset?: () => void;
  disabled?: boolean;
};

/** Label (scrubbable) + Slider + NumberInput readout on the same row. */
export function SliderField({ label, value, onChange, min, max, step = 1, unit, hint, modified, onReset, disabled }: SliderFieldProps) {
  const scrub = useScrub({ value, onChange, step, min, max, disabled });
  return (
    <Row
      label={label}
      hint={hint}
      modified={modified}
      onReset={onReset}
      labelProps={{ ...scrub.handlers, "data-scrub": true, "data-scrubbing": scrub.scrubbing || undefined }}
    >
      <Slider value={value} onChange={onChange} min={min} max={max} step={step} disabled={disabled} aria-label={typeof label === "string" ? label : undefined} />
      <div className="at-row-value">
        <NumberInput value={value} onChange={onChange} min={min} max={max} step={step} unit={unit} disabled={disabled} aria-label={typeof label === "string" ? label : undefined} />
      </div>
    </Row>
  );
}

/** Number field without slider, label still scrubbable. */
export function NumberField({ label, value, onChange, min, max, step = 1, unit, hint, modified, onReset }: SliderFieldProps) {
  const scrub = useScrub({ value, onChange, step, min, max });
  return (
    <Row label={label} hint={hint} modified={modified} onReset={onReset} labelProps={{ ...scrub.handlers, "data-scrub": true }}>
      <div className="at-row-control-end">
        <NumberInput value={value} onChange={onChange} min={min} max={max} step={step} unit={unit} />
      </div>
    </Row>
  );
}

/* ---------------------------------------------------------- SpringField */

export function SpringField({
  label,
  value,
  onChange,
  modified,
  onReset,
  hint,
}: {
  label: ReactNode;
  value: SpringToken;
  onChange: (v: SpringToken) => void;
  modified?: boolean;
  onReset?: () => void;
  hint?: ReactNode;
}) {
  return (
    <div className="at-spring-field">
      <div className="at-spring-title">
        {modified && (
          <button type="button" className="at-row-modified" aria-label="已修改，点击重置" title="已修改 · 点击重置" onClick={onReset} />
        )}
        <span>{label}</span>
        {hint && <span className="at-row-hint">{hint}</span>}
      </div>
      <SliderField
        label="时长"
        value={value.visualDuration}
        onChange={(v) => onChange({ ...value, visualDuration: v })}
        min={0.02}
        max={1.2}
        step={0.01}
        unit="s"
      />
      <SliderField label="弹性" value={value.bounce} onChange={(v) => onChange({ ...value, bounce: v })} min={0} max={0.9} step={0.01} />
    </div>
  );
}

/* ------------------------------------------------------- ParamControls */

const eq = (a: ParamValue, b: ParamValue) =>
  typeof a === "number" || typeof b === "number"
    ? a === b
    : Math.abs(a.visualDuration - b.visualDuration) < 1e-6 && Math.abs(a.bounce - b.bounce) < 1e-6;

/** Build controls from a param schema. Groups follow def.group. */
export function ParamControls({
  schema,
  values,
  defaults,
  onChange,
  onReset,
}: {
  schema: ParamDef[];
  values: Record<string, ParamValue>;
  defaults: Record<string, ParamValue>;
  onChange: (key: string, v: ParamValue) => void;
  onReset: (key: string) => void;
}) {
  const groups: [string, ParamDef[]][] = [];
  for (const d of schema) {
    const g = groups.find((x) => x[0] === d.group);
    if (g) g[1].push(d);
    else groups.push([d.group, [d]]);
  }
  return (
    <>
      {groups.map(([g, defs]) => (
        <PanelGroup key={g} title={g}>
          {defs.map((d) => {
            const val = values[d.key];
            const modified = !eq(val, defaults[d.key]);
            const hint = d.hint ?? (d.inherit ? `默认继承 ${d.type === "spring" ? "spring" : "feel"}.${d.inherit}` : undefined);
            if (d.type === "spring")
              return (
                <SpringField
                  key={d.key}
                  label={d.label}
                  hint={d.inherit ? `← spring.${d.inherit}` : undefined}
                  value={val as SpringToken}
                  onChange={(v) => onChange(d.key, v)}
                  modified={modified}
                  onReset={() => onReset(d.key)}
                />
              );
            return (
              <SliderField
                key={d.key}
                label={d.label}
                hint={hint}
                value={val as number}
                onChange={(v) => onChange(d.key, v)}
                min={d.min}
                max={d.max}
                step={d.step}
                unit={d.unit}
                modified={modified}
                onReset={() => onReset(d.key)}
              />
            );
          })}
        </PanelGroup>
      ))}
    </>
  );
}

/* ----------------------------------------------------------- PanelGroup */

export function PanelGroup({
  title,
  badge,
  children,
  defaultOpen = true,
  actions,
}: {
  title: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { springs, reduced } = useFeelState();
  return (
    <section className="at-group" data-open={open || undefined}>
      <div className="at-group-head">
        <button type="button" className="at-group-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <motion.svg width="10" height="10" viewBox="0 0 10 10" animate={{ rotate: open ? 0 : -90 }} transition={springTransition(springs.snappy, reduced)} aria-hidden>
            <path d="M2 3.75 5 6.75 8 3.75" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
          <span className="at-group-title">{title}</span>
          {badge && <span className="at-group-badge">{badge}</span>}
        </button>
        {actions && <div className="at-group-actions">{actions}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="at-reveal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { height: springTransition(springs.pop, reduced), opacity: { duration: 0.16 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: springTransition(springs.pop, reduced, { exit: true }), opacity: { duration: 0.1 } } }}
          >
            <div className="at-reveal-inner at-group-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ---------------------------------------------------------------- Panel */

export type PanelProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** floating: fixed over the page, draggable by its header, collapsible */
  floating?: boolean;
  onClose?: () => void;
  className?: string;
  style?: object;
};

/** Tool panel (Handoff §7 可挂载的工具面板) */
export function Panel({ title, subtitle, actions, footer, children, floating, onClose, className, style }: PanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const { springs, reduced } = useFeelState();

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!floating || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setPos({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
  };

  return (
    <div
      className={`at-panel ${className ?? ""}`}
      data-floating={floating || undefined}
      data-collapsed={collapsed || undefined}
      style={{ ...(floating ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : {}), ...style }}
    >
      <div
        className="at-panel-head"
        data-draggable={floating || undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
      >
        <div className="at-panel-titles">
          <div className="at-panel-title">{title}</div>
          {subtitle && <div className="at-panel-subtitle">{subtitle}</div>}
        </div>
        <div className="at-panel-actions">
          {actions}
          {floating && (
            <button type="button" className="at-icon-btn" aria-label={collapsed ? "展开面板" : "收起面板"} onClick={() => setCollapsed((c) => !c)}>
              <motion.svg width="12" height="12" viewBox="0 0 12 12" animate={{ rotate: collapsed ? 180 : 0 }} transition={springTransition(springs.snappy, reduced)}>
                <path d="M3 7.5 6 4.5 9 7.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </button>
          )}
          {onClose && (
            <button type="button" className="at-icon-btn" aria-label="关闭" onClick={onClose}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3.5 3.5l5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="at-panel-collapse"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { height: springTransition(springs.pop, reduced), opacity: { duration: 0.16 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: springTransition(springs.pop, reduced, { exit: true }), opacity: { duration: 0.1 } } }}
          >
            <div className="at-panel-body">{children}</div>
            {footer && <div className="at-panel-footer">{footer}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
