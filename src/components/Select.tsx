import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValueEvent, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { clamp, lerp } from "../core/geometry";
import { useAnimated } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";
import { IconCheck, MotionChevronDown } from "../core/icons";
import { controlHeight, type ControlSize } from "../tokens/tokens";

export type SelectOption<V extends string> = { value: V; label: ReactNode; hint?: ReactNode };

export type SelectProps<V extends string> = {
  size?: ControlSize;
  options: SelectOption<V>[];
  value: V;
  onChange: (v: V) => void;
  width?: number | string;
  listWidth?: number;
  disabled?: boolean;
  "aria-label"?: string;
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
export function Select<V extends string>({ options, value, onChange, width, listWidth, disabled, size = "md", feel: local, ...aria }: SelectProps<V>) {
  const ROW = controlHeight(size);
  const { p, t } = useFeel("select", local);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(0);
  const o = useAnimated(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ROW]);

  // outside click / scroll / resize close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (popRef.current?.contains(tgt) || triggerRef.current?.contains(tgt)) return;
      doClose();
    };
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
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
  const listH = options.length * ROW + PAD * 2;
  const tw = rect?.width ?? 0;
  const th = rect?.height ?? ROW;
  const fullW = Math.max(tw, listWidth ?? 0);
  const fullH = th + listH;
  const up = rect ? rect.top + fullH > window.innerHeight - 8 && rect.top > fullH : false;
  const w = useTransform(o.mv, (v) => lerp(tw, fullW, clamp(v, 0, 1.2)));
  const hgt = useTransform(o.mv, (v) => Math.max(th, lerp(th, fullH, v)));
  const top = useTransform(hgt, (hh) => (rect ? (up ? rect.bottom - hh : rect.top) : 0));
  const listOpacity = useTransform(o.mv, (v) => clamp((v - 0.35) / 0.45, 0, 1));
  const chevronRotate = useTransform(o.mv, (v) => clamp(v, 0, 1) * 180);
  const hlY = hlTop.mv;
  const hlH = useTransform([hlTop.mv, hlBot.mv] as const, ([a, b]: number[]) => Math.max(0, b - a));

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
            className="at-select-pop"
            data-control-size={size}
            data-up={up || undefined}
            data-at-interactive
            style={{ left: rect.left, top, width: w, height: hgt }}
          >
            <button type="button" className="at-select-header" tabIndex={-1} onClick={doClose} style={{ height: th }}>
              <span className="at-select-value">{current?.label}</span>
              <Chevron style={{ rotate: chevronRotate }} />
            </button>
            <motion.div className="at-select-list" role="listbox" id={listId} style={{ opacity: listOpacity, padding: PAD }}>
              <div className="at-select-rows">
                <motion.div className="at-select-hl" style={{ y: hlY, height: hlH }} aria-hidden />
                {options.map((opt, i) => (
                  <div
                    key={opt.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === selIdx}
                    className="at-select-option"
                    data-selected={i === selIdx || undefined}
                    data-active={i === active || undefined}
                    style={{ height: ROW }}
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
              </div>
            </motion.div>
          </motion.div>,
          document.body,
        )}
    </>
  );
}
