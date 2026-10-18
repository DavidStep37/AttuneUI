import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { useAnimated, useSize } from "../core/hooks";
import { clamp } from "../core/geometry";
import type { ResolvedFeel } from "../core/schema";
import type { ControlSize } from "../tokens/tokens";

export type TabItem<V extends string> = { value: V; label: ReactNode; content: ReactNode; disabled?: boolean };
export type TabsProps<V extends string> = {
  size?: ControlSize;
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  "aria-label": string;
  feel?: Partial<ResolvedFeel<"tabs">>;
};

export function Tabs<V extends string>({ items, value, onChange, size = "md", feel: local, ...aria }: TabsProps<V>) {
  const { p, t, reduced, deform } = useFeel("tabs", local);
  const id = useId();
  const [ref, box] = useSize<HTMLDivElement>();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const left = useAnimated(0);
  const right = useAnimated(0);
  const baseWidth = useAnimated(0);
  const target = useRef<{ left: number; right: number; index: number; box: number; size: ControlSize } | null>(null);
  const found = items.findIndex(item => item.value === value && !item.disabled);
  const index = found >= 0 ? found : items.findIndex(item => !item.disabled);
  useLayoutEffect(() => {
    const button = buttons.current[index];
    const l = button ? button.offsetLeft + 10 : 0;
    const r = button ? l + Math.max(0, button.offsetWidth - 20) : 0;
    const previous = target.current;
    target.current = { left: l, right: r, index, box: box.width, size };
    // Measurements/reflow snap to the selected label. Only selection changes
    // travel; interruptions start at the two edges' current positions.
    if (!previous || reduced || previous.box !== box.width || previous.size !== size || !button) {
      left.set(l); right.set(r); baseWidth.set(r - l);
      return;
    }
    if (previous.left === l && previous.right === r) return;
    const movingRight = l + r > left.mv.get() + right.mv.get();
    const stretch = clamp(p.indicatorStretch * deform, 0, 1);
    const head = t({ ...p.indicatorSpring, visualDuration: p.indicatorSpring.visualDuration * (1 - 0.35 * stretch) });
    const tail = t({ ...p.indicatorSpring, visualDuration: p.indicatorSpring.visualDuration * (1 + 0.65 * stretch) });
    left.to(l, movingRight ? tail : head);
    right.to(r, movingRight ? head : tail);
    baseWidth.to(r - l, t(p.indicatorSpring));
  }, [index, box.width, size, items, reduced, deform, p.indicatorSpring, p.indicatorStretch, t,
    left.mv, left.set, left.to, right.mv, right.set, right.to, baseWidth.set, baseWidth.to]);
  const width = useTransform(() => Math.max(0, right.mv.get() - left.mv.get()));
  const height = useTransform(() => {
    const stretch = Math.max(0, width.get() / Math.max(1, baseWidth.mv.get()) - 1);
    return 3 / (1 + Math.min(1, stretch * p.stretchThin * deform));
  });
  const active = items[index];
  return (
    <div className="at-tabs" data-control-size={size} data-at-interactive>
      <div ref={ref} className="at-tab-list" role="tablist" aria-label={aria["aria-label"]}
        onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          const enabled = items.map((item, i) => !item.disabled ? i : -1).filter(i => i >= 0);
          if (!enabled.length) return;
          e.preventDefault();
          const current = enabled.indexOf(index);
          const next = e.key === "Home" ? enabled[0] : e.key === "End" ? enabled.at(-1)!
            : enabled[(current + (e.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
          onChange(items[next].value); buttons.current[next]?.focus();
        }}>
        {items.map((item, i) => <button key={item.value} ref={el => { buttons.current[i] = el; }} type="button"
          className="at-tab" role="tab" id={`${id}-tab-${i}`} aria-controls={`${id}-panel-${i}`}
          aria-selected={i === index} tabIndex={i === index ? 0 : -1} disabled={item.disabled}
          onClick={() => onChange(item.value)}>{item.label}</button>)}
        <motion.span className="at-tab-indicator" aria-hidden style={{ left: left.mv, width, height }} />
      </div>
      <AnimatePresence initial={false} mode="wait">
        {active && <motion.div key={active.value} role="tabpanel" tabIndex={0} className="at-tab-panel"
          id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`}
          initial={{ opacity: 0, y: reduced ? 0 : p.contentOffset * deform }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -p.contentOffset * deform * 0.5 }}
          transition={{ duration: reduced ? 0 : p.contentDuration / 1000, ease: [0.2, 0, 0, 1] }}>
          {active.content}
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}
