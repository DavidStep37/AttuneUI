import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValueEvent } from "motion/react";
import { useFeelState, springTransition } from "../core/feel";
import { annularSector, clamp, gaussian } from "../core/geometry";
import { useAnimated, useLatest } from "../core/hooks";
import { useAttuneScope } from "../core/surface";
import type { ControlSize, SpringToken } from "../tokens/tokens";

/**
 * RadialPicker — 圆盘呼出（实验组件）
 * For a small, fixed set of options (e.g. easing presets). Clicking the trigger
 * pops a disc centred on it; options divide the ring equally. The hovered sector
 * Visual language follows the Slider: a sunken base (外壳) holds one tile per option
 * (内芯), inset by the same 2.5px gap. The hovered tile takes the graphite fill and,
 * with the rim, swells outward (局部撑起); the swell glides between sectors.
 *
 * Pointer: click → pick → click, or press on the trigger, flick toward an option
 * and release (marking-menu style). Keyboard: ←/→ (↑/↓) rotate, 1–9 pick, Enter
 * confirm, Esc close.
 */

export type RadialOption<V extends string> = { value: V; label: ReactNode; icon?: ReactNode; hint?: ReactNode };

export type RadialFeel = {
  /** disc outer radius (px) */
  radius: number;
  /** central hub radius (px) */
  hubRadius: number;
  /** gap between the disc shell and the hovered core, and between sectors (px) */
  gap: number;
  /** outward swell of the rim around the hovered sector (px) */
  bulge: number;
  /** swell falloff, as a fraction of one sector's arc */
  bulgeWidth: number;
  popSpring: SpringToken;
  hoverSpring: SpringToken;
};

export const radialFeelDefaults: RadialFeel = {
  radius: 124,
  hubRadius: 44,
  gap: 2.5,
  bulge: 6,
  bulgeWidth: 0.5,
  popSpring: { visualDuration: 0.36, bounce: 0.28 },
  hoverSpring: { visualDuration: 0.22, bounce: 0.18 },
};

export type RadialPickerProps<V extends string> = {
  options: RadialOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  /** trigger content; defaults to the current option's icon + label */
  children?: ReactNode;
  /** render inside the hub for the hovered (or current) option */
  renderHub?: (option: RadialOption<V> | null, hovered: boolean) => ReactNode;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
  size?: ControlSize;
  /** trigger style (e.g. width) */
  style?: CSSProperties;
  feel?: Partial<RadialFeel>;
};

const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
/** signed shortest angular difference a - b in (-π, π] */
const angDiff = (a: number, b: number) => {
  const d = wrap(a - b);
  return d > Math.PI ? d - TAU : d;
};
const f = (v: number) => (Math.round(v * 100) / 100).toString();

/** Angle of sector i's centre: first option at 12 o'clock, clockwise (screen y-down). */
const sectorAngle = (i: number, n: number) => -Math.PI / 2 + (i * TAU) / n;

export function RadialPicker<V extends string>({ options, value, onChange, children, renderHub, disabled, className, size: controlSize = "md", style, feel: local, ...aria }: RadialPickerProps<V>) {
  const fp = { ...radialFeelDefaults, ...local };
  const { reduced, shared } = useFeelState();
  const deform = reduced ? 0 : shared.deformScale;
  const scope = useAttuneScope();
  const id = useId();
  const n = options.length;
  const sel = options.findIndex((o) => o.value === value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [centre, setCentre] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState<number | null>(null);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const R = fp.radius;
  const r0 = fp.hubRadius;
  const pad = fp.bulge + 24; // room for the swell and shadow
  const size = (R + pad) * 2;

  const hoverAngle = useAnimated(sectorAngle(Math.max(0, sel), n));
  const hoverAmt = useAnimated(0);

  /* ---------------------------------------------------------------- open / close */

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const m = R + 16;
    setCentre({
      x: clamp(r.left + r.width / 2, m, window.innerWidth - m),
      y: clamp(r.top + r.height / 2, m, window.innerHeight - m),
    });
  }, [R]);

  const doOpen = (hover: number | null) => {
    if (disabled || n === 0) return;
    place();
    setActive(hover);
    hoverAngle.set(sectorAngle(hover ?? Math.max(0, sel), n));
    hoverAmt.set(0);
    setOpen(true);
  };
  const doClose = useCallback(() => {
    setOpen(false);
    setActive(null);
    press.current = null;
  }, []);
  const choose = (i: number) => {
    onChange(options[i].value);
    doClose();
    triggerRef.current?.focus({ preventScroll: true });
  };
  const chooseRef = useLatest(choose);

  // hover glides along the shortest arc; the swell eases in and out
  const prevActive = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    if (active === null) {
      hoverAmt.to(0, springTransition(fp.hoverSpring, reduced, { exit: true }));
    } else {
      const target = sectorAngle(active, n);
      const cur = hoverAngle.mv.get();
      const to = cur + angDiff(target, cur);
      if (prevActive.current === null) hoverAngle.set(to);
      else hoverAngle.to(to, springTransition(fp.hoverSpring, reduced));
      hoverAmt.to(1, springTransition(fp.hoverSpring, reduced));
    }
    prevActive.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);
  useEffect(() => {
    if (!open) prevActive.current = null;
  }, [open]);

  /* ---------------------------------------------------------------- pointer */

  const pointToIndex = useCallback(
    (x: number, y: number) => {
      const dx = x - centre.x;
      const dy = y - centre.y;
      const d = Math.hypot(dx, dy);
      if (d < r0 + 2 || d > R + 56) return null;
      const a = Math.atan2(dy, dx);
      // nearest sector centre
      return ((Math.round(wrap(a + Math.PI / 2) / (TAU / n)) % n) + n) % n;
    },
    [centre, r0, R, n],
  );

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && e.buttons === 0) return;
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.moved = true;
      setActive(pointToIndex(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      const i = pointToIndex(e.clientX, e.clientY);
      // press-on-trigger + flick + release = pick; a plain click keeps the disc open
      if (p && !p.moved) return;
      if (i !== null) chooseRef.current(i);
      else if (Math.hypot(e.clientX - centre.x, e.clientY - centre.y) > R + 56) doClose();
      else if (Math.hypot(e.clientX - centre.x, e.clientY - centre.y) < r0) doClose();
    };
    const onScroll = () => doClose();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, pointToIndex, centre, R, r0, doClose, chooseRef]);

  useLayoutEffect(() => {
    if (open) discRef.current?.focus({ preventScroll: true });
  }, [open]);

  const onTriggerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    if (open) {
      doClose();
      return;
    }
    e.preventDefault();
    press.current = { x: e.clientX, y: e.clientY, moved: false };
    doOpen(null);
  };

  /* ---------------------------------------------------------------- keyboard */

  const onTriggerKey = (e: KeyboardEvent) => {
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      doOpen(Math.max(0, sel));
    }
  };
  const onDiscKey = (e: KeyboardEvent) => {
    const cur = active ?? Math.max(0, sel);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      doClose();
      triggerRef.current?.focus({ preventScroll: true });
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive((cur + 1) % n);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((cur - 1 + n) % n);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(cur);
    } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) {
      e.preventDefault();
      choose(Number(e.key) - 1);
    } else if (e.key === "Tab") doClose();
  };

  /* ---------------------------------------------------------------- geometry */

  const c = size / 2;
  const sectorArc = TAU / n;
  const sigma = Math.max(0.12, sectorArc * fp.bulgeWidth);

  // Geometry is recomputed on every hover frame (n ≤ ~8 tiles, cheap).
  const [, force] = useState(0);
  useMotionValueEvent(hoverAmt.mv, "change", () => force((v) => v + 1));
  useMotionValueEvent(hoverAngle.mv, "change", () => force((v) => v + 1));
  const ha = hoverAngle.mv.get();
  const h = clamp(hoverAmt.mv.get(), 0, 1.2);

  // Base (外壳): outer rim swells around the hover angle; every tile follows it,
  // so the hovered tile and its rim bulge together and the gap stays constant.
  const swellAt = (a: number) => fp.bulge * h * deform * gaussian(angDiff(a, ha), sigma);
  const rimR = (a: number) => R + swellAt(a);
  let rimD = "";
  for (let k = 0; k < 240; k++) {
    const a = (k / 240) * TAU;
    const r = rimR(a);
    rimD += `${k ? "L" : "M"}${f(c + Math.cos(a) * r)} ${f(c + Math.sin(a) * r)}`;
  }
  rimD += "Z";

  // Tiles (内芯): annular sectors with one constant gap everywhere — to the rim,
  // to the hub and to each neighbour (parallel sides, see annularSector).
  // Rounded corners: inset the polygon by the corner radius, then draw it with a
  // round-joined stroke of twice that width. The 1px border sits inside the tile.
  const corner = 7;
  const BASE_STROKE = 0.5; // inner half of the base's 1px border
  const tilePath = (i: number) => {
    const pts = annularSector({
      cx: c, cy: c,
      mid: sectorAngle(i, n), half: sectorArc / 2,
      rIn: r0 + fp.gap + corner,
      rOut: (a) => rimR(a) - BASE_STROKE - fp.gap - corner,
      side: fp.gap / 2 + corner,
    });
    return pts.length ? pts.map(([x, y], q) => `${q ? "L" : "M"}${f(x)} ${f(y)}`).join("") + "Z" : "";
  };

  // Labels ride the swell a little so text stays centred in a growing tile.
  const labelAt = (i: number) => {
    const a = sectorAngle(i, n);
    const rr = (r0 + R) / 2 + 1 + swellAt(a) * 0.5;
    return { x: c + Math.cos(a) * rr, y: c + Math.sin(a) * rr };
  };

  const current = sel >= 0 ? options[sel] : null;
  const shown = active !== null ? options[active] : current;
  const pop = springTransition(fp.popSpring, reduced);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`at-select-trigger at-radial-trigger ${className ?? ""}`}
        data-control-size={controlSize}
        data-open-radial={open || undefined}
        data-at-interactive
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-disc`}
        aria-label={aria["aria-label"]}
        disabled={disabled}
        style={style}
        onPointerDown={onTriggerDown}
        onKeyDown={onTriggerKey}
      >
        {children ?? (
          <>
            <span className="at-select-value at-radial-trigger-value">
              {current?.icon && <span className="at-radial-trigger-icon">{current.icon}</span>}
              <span className="at-radial-trigger-label">{current?.label ?? "选择"}</span>
            </span>
            <span className="at-radial-trigger-mark" aria-hidden />
          </>
        )}
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="disc"
              {...scope}
              ref={discRef}
              id={`${id}-disc`}
              className="at-radial"
              role="listbox"
              aria-label={aria["aria-label"]}
              aria-activedescendant={active !== null ? `${id}-opt-${active}` : undefined}
              tabIndex={-1}
              data-at-interactive
              onKeyDown={onDiscKey}
              style={{ ...scope.style, left: centre.x - c, top: centre.y - c, width: size, height: size }}
              initial={{ opacity: 0, scale: reduced ? 1 : 0.45, rotate: reduced ? 0 : -14 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, transition: { ...pop, opacity: { duration: 0.12 } } }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.7, rotate: reduced ? 0 : 8, transition: { ...springTransition(fp.popSpring, reduced, { exit: true }), opacity: { duration: 0.14 } } }}
            >
              <svg className="at-radial-svg" width={size} height={size} aria-hidden>
                <path className="at-radial-base" d={rimD} />
                {options.map((o, i) => (
                  <g key={o.value} className="at-radial-tile" data-active={i === active || undefined} data-selected={i === sel || undefined}>
                    {/* edge = the tile outline; face is the same polygon stroked 2px narrower → 1px inner border */}
                    <path className="at-radial-tile-edge" d={tilePath(i)} strokeWidth={corner * 2} strokeLinejoin="round" />
                    <path className="at-radial-tile-face" d={tilePath(i)} strokeWidth={corner * 2 - 2} strokeLinejoin="round" />
                  </g>
                ))}
              </svg>

              {options.map((o, i) => {
                const p = labelAt(i);
                return (
                  <motion.div
                    key={o.value}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={i === sel}
                    className="at-radial-option"
                    data-active={i === active || undefined}
                    data-selected={i === sel || undefined}
                    style={{ left: p.x, top: p.y, x: "-50%", y: "-50%" }}
                    initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
                    animate={{ opacity: 1, scale: 1, transition: { ...pop, delay: reduced ? 0 : 0.03 + i * 0.018 } }}
                    exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  >
                    {o.icon && <span className="at-radial-option-icon">{o.icon}</span>}
                    <span className="at-radial-option-label">{o.label}</span>
                    {i === sel && <span className="at-radial-option-mark" aria-hidden />}
                  </motion.div>
                );
              })}

              <button
                type="button"
                className="at-radial-hub"
                tabIndex={-1}
                aria-label="关闭"
                style={{ width: r0 * 2, height: r0 * 2, left: c - r0, top: c - r0 }}
                onClick={doClose}
              >
                {renderHub ? renderHub(shown, active !== null) : <span className="at-radial-hub-label">{shown?.label}</span>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
