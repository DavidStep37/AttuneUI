import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValueEvent, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { clamp, lerp, rubber } from "../core/geometry";
import { useAnimated } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";
import { IconCheck, MotionChevronDown } from "../core/icons";
import { controlHeight, type ControlSize } from "../tokens/tokens";
import { useAttuneScope } from "../core/surface";
import { RadialPicker, type RadialFeel } from "./RadialPicker";

export type SelectOption<V extends string> = { value: V; label: ReactNode; hint?: ReactNode; /** used by the radial variant */ icon?: ReactNode };

export type SelectProps<V extends string> = {
  size?: ControlSize;
  options: SelectOption<V>[];
  value: V;
  onChange: (v: V) => void;
  width?: number | string;
  listWidth?: number;
  disabled?: boolean;
  "aria-label"?: string;
  /**
   * dropdown (default): the trigger grows into a list.
   * radial: options divide a disc that pops out of the trigger — for a small,
   * fixed set (about 3–8 short labels).
   */
  variant?: "dropdown" | "radial";
  /** dropdown: rows shown before the list scrolls */
  maxVisible?: number;
  /** radial: content of the centre hub for the hovered / current option */
  renderHub?: (option: SelectOption<V> | null, hovered: boolean) => ReactNode;
  /** radial: disc geometry and springs */
  radialFeel?: Partial<RadialFeel>;
  feel?: Partial<ResolvedFeel<"select">>;
};

const PAD = 4;

const Chevron = ({ style }: { style?: object }) => (
  <MotionChevronDown className="at-select-chevron" size={12} strokeWidth={1.75} style={style} aria-hidden="true" />
);

/**
 * Select — 列表从入口处被撑开、生长出来 (Handoff §5.8)
 * The list is the trigger itself growing: same surface, same header row.
 */
export function Select<V extends string>(props: SelectProps<V>) {
  if (props.variant === "radial") {
    const { options, value, onChange, width, disabled, size = "md", renderHub, radialFeel, ...aria } = props;
    return (
      <RadialPicker
        aria-label={aria["aria-label"]}
        size={size}
        style={{ width }}
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={options}
        renderHub={renderHub}
        feel={radialFeel}
      />
    );
  }
  return <DropdownSelect {...props} />;
}

/**
 * Dropdown — 列表从入口处被撑开、生长出来 (Handoff §5.8)
 * The list is the trigger itself growing: same surface, same header row.
 * Scrolling past the last row stretches the menu downward (触底拉伸) and springs back.
 */
function DropdownSelect<V extends string>({ options, value, onChange, width, listWidth, disabled, size = "md", maxVisible = 6, feel: local, ...aria }: SelectProps<V>) {
  const scope = useAttuneScope();
  const ROW = controlHeight(size);
  const { p, t, deform } = useFeel("select", local);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(0);
  const o = useAnimated(0);
  const stretch = useAnimated(0);
  const viewRef = useRef<HTMLDivElement>(null);
  const hlTop = useAnimated(0);
  const hlBot = useAnimated(ROW);
  const listId = useId();
  const selIdx = Math.max(0, options.findIndex((x) => x.value === value));
  const current = options[selIdx];

  const doOpen = () => {
    if (disabled) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect(r);
    setActive(selIdx);
    hlTop.set(selIdx * ROW);
    hlBot.set(selIdx * ROW + ROW);
    setMounted(true);
    setOpen(true);
  };
  const doClose = () => setOpen(false);
  useEffect(() => setOpen(false), [size]);

  useEffect(() => {
    if (!mounted) return;
    o.to(open ? 1 : 0, t(p.openSpring, { exit: !open }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  useMotionValueEvent(o.mv, "animationComplete", () => {
    if (!open) setMounted(false);
  });
  useEffect(() => {
    // reduced motion: instant transitions never fire animationComplete
    if (!open && mounted && o.mv.get() === 0) setMounted(false);
  });

  // highlight follows the active row: leading edge fast, trailing edge stretched
  const prevActive = useRef(active);
  useLayoutEffect(() => {
    if (!mounted) return;
    const down = active > prevActive.current;
    prevActive.current = active;
    const lead = t(p.highlightSpring);
    const trail = t({ ...p.highlightSpring, visualDuration: p.highlightSpring.visualDuration * (1 + p.highlightStretch) });
    hlTop.to(active * ROW, down ? trail : lead);
    hlBot.to(active * ROW + ROW, down ? lead : trail);
    const v = viewRef.current;
    if (v) {
      if (active * ROW < v.scrollTop) v.scrollTop = active * ROW;
      else if ((active + 1) * ROW > v.scrollTop + v.clientHeight) v.scrollTop = (active + 1) * ROW - v.clientHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ROW]);

  // Overscroll at the bottom: wheel / touch past the last row stretches the menu
  // downward with rubber-band resistance, then springs back when input stops.
  useEffect(() => {
    const v = viewRef.current;
    if (!mounted || !v) return;
    let acc = 0;
    let idle = 0;
    let touchY: number | null = null;
    const atBottom = () => v.scrollTop + v.clientHeight >= v.scrollHeight - 1;
    const release = () => {
      acc = 0;
      stretch.to(0, t(p.overscrollSpring));
    };
    const push = (delta: number) => {
      acc = Math.max(0, acc + delta);
      stretch.set(rubber(acc, 0.5, p.overscroll * Math.min(1, deform)));
      window.clearTimeout(idle);
      idle = window.setTimeout(release, 140);
    };
    const onWheel = (e: WheelEvent) => {
      if (!deform || p.overscroll <= 0) return;
      const dy = e.deltaMode === 1 ? e.deltaY * ROW : e.deltaY;
      if ((dy > 0 && atBottom()) || (dy < 0 && acc > 0)) {
        e.preventDefault();
        push(dy);
      }
    };
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined || !deform) return;
      const dy = touchY - y;
      touchY = y;
      if ((dy > 0 && atBottom()) || (dy < 0 && acc > 0)) {
        e.preventDefault();
        push(dy);
      }
    };
    const onTouchEnd = () => { touchY = null; if (acc > 0) release(); };
    v.addEventListener("wheel", onWheel, { passive: false });
    v.addEventListener("touchstart", onTouchStart, { passive: true });
    v.addEventListener("touchmove", onTouchMove, { passive: false });
    v.addEventListener("touchend", onTouchEnd);
    return () => {
      window.clearTimeout(idle);
      v.removeEventListener("wheel", onWheel);
      v.removeEventListener("touchstart", onTouchStart);
      v.removeEventListener("touchmove", onTouchMove);
      v.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, ROW, deform, p.overscroll, p.overscrollSpring]);
  useEffect(() => { if (!open) stretch.set(0); }, [open, stretch]);

  // outside click / scroll / resize close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (popRef.current?.contains(tgt) || triggerRef.current?.contains(tgt)) return;
      doClose();
    };
    const onScroll = (e: Event) => {
      // Scrolling the popup's own list must not close it; the wheel handler owns
      // the list's scroll, so the event target is the scroll viewport itself.
      const tgt = e.target as Node;
      if (popRef.current?.contains(tgt) || viewRef.current?.contains(tgt)) return;
      doClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", doClose);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", doClose);
    };
  }, [open]);

  const choose = (i: number) => {
    onChange(options[i].value);
    doClose();
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        doOpen();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      doClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") doClose();
  };

  // geometry of the growing surface
  const visible = Math.max(1, Math.min(options.length, maxVisible));
  const viewH = visible * ROW;
  const maxScroll = Math.max(0, options.length - visible) * ROW;
  const listH = viewH + PAD * 2;
  const tw = rect?.width ?? 0;
  const th = rect?.height ?? ROW;
  const fullW = Math.max(tw, listWidth ?? 0);
  const fullH = th + listH;
  const up = rect ? rect.top + fullH > window.innerHeight - 8 && rect.top > fullH : false;
  const w = useTransform(o.mv, (v) => lerp(tw, fullW, clamp(v, 0, 1.2)));
  const hgt = useTransform([o.mv, stretch.mv] as const, ([v, st]: number[]) => Math.max(th, lerp(th, fullH, v)) + st);
  const top = useTransform(hgt, (hh) => (rect ? (up ? rect.bottom - hh : rect.top) : 0));
  const listOpacity = useTransform(o.mv, (v) => clamp((v - 0.35) / 0.45, 0, 1));
  const chevronRotate = useTransform(o.mv, (v) => clamp(v, 0, 1) * 180);
  // Rows spread apart while stretched: the deeper in the viewport, the more it moves.
  const depthOf = (i: number) => clamp(((i + 1) * ROW - maxScroll) / viewH, 0, 1) * 0.6;
  // `y` stays a motion value so Motion keeps driving the transform.
  const hlY = useTransform([hlTop.mv, stretch.mv] as const, ([t, st]: number[]) => t + st * depthOf(active));
  const hlH = useTransform([hlTop.mv, hlBot.mv] as const, ([a, b]: number[]) => Math.max(0, b - a));
  // The viewport and the content grow together, so the scroll position holds
  // while rows spread out: row k moves by stretch × its depth in the viewport.
  const viewHeight = useTransform(stretch.mv, (st) => viewH + st);
  const stretchVar = useTransform(stretch.mv, (st) => `${st}px`);

  const header = (
    <>
      <span className="at-select-value">{current?.label}</span>
      <Chevron />
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="at-select-trigger"
        data-control-size={size}
        data-at-interactive
        data-open={mounted || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={aria["aria-label"]}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        style={{ width }}
        onClick={() => (open ? doClose() : doOpen())}
        onKeyDown={onKeyDown}
      >
        {header}
      </button>
      {mounted &&
        rect &&
        createPortal(
          <motion.div
            ref={popRef}
            {...scope}
            className="at-root at-select-pop"
            data-control-size={size}
            data-up={up || undefined}
            data-at-interactive
            style={{ ...scope.style, left: rect.left, top, width: w, height: hgt, ["--at-select-stretch" as string]: stretchVar }}
          >
            <button type="button" className="at-select-header" tabIndex={-1} onClick={doClose} style={{ height: th }}>
              <span className="at-select-value">{current?.label}</span>
              <Chevron style={{ rotate: chevronRotate }} />
            </button>
            <motion.div className="at-select-list" role="listbox" id={listId} style={{ opacity: listOpacity, padding: PAD }}>
              <motion.div ref={viewRef} className="at-select-view" style={{ height: viewHeight }}>
              <motion.div className="at-select-rows" style={{ paddingBottom: stretch.mv }}>
                <motion.div
                  className="at-select-hl"
                  style={{ y: hlY, height: hlH }}
                  aria-hidden
                />
                {options.map((opt, i) => (
                  <div
                    key={opt.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === selIdx}
                    className="at-select-option"
                    data-selected={i === selIdx || undefined}
                    data-active={i === active || undefined}
                    style={{ height: ROW, transform: `translateY(calc(var(--at-select-stretch, 0px) * ${depthOf(i)}))` }}
                    onPointerMove={() => i !== active && setActive(i)}
                    onClick={() => choose(i)}
                  >
                    <span className="at-select-check" aria-hidden>
                      {i === selIdx && (
                        <IconCheck size={12} />
                      )}
                    </span>
                    <span className="at-select-option-label">{opt.label}</span>
                    {opt.hint && <span className="at-select-option-hint">{opt.hint}</span>}
                  </div>
                ))}
              </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>,
          document.body,
        )}
    </>
  );
}
