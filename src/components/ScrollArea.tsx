import { useCallback, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type PointerEvent, type Ref, type WheelEvent } from "react";
import { animate, motion, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { clamp } from "../core/geometry";
import { useAnimated } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";

export type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  /** Class for the scrolling viewport (put padding here, not on the root). */
  viewportClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
  /** Paint the Attune scrollbar (default). `false`: still scrollable, no bar — pair with `fade`. */
  scrollbar?: boolean;
  /** Fade the bottom edge while more content lies below; gone once scrolled to the end. */
  fade?: boolean;
  feel?: Partial<ResolvedFeel<"scrollbar">>;
};

/** Vertical gap between the track and the viewport's top/bottom edges. */
const EDGE = 4;
/** Extra pointer distance outside the bar that still counts as "near". */
const REACH = 8;

/**
 * Scrollbar — 软轨道里的刚性滑块，碰到尽头被轻轻压扁
 * Native scrolling stays (wheel, touch, keyboard, a11y); only the painted bar is replaced.
 * Idle: a thin graphite thumb that appears while scrolling or hovering the area.
 * Near: the thumb thickens, the light outer track wraps it with a fixed inset (like Slider),
 * and a white grip dot marks it as something you can hold. Scrolling past an end squashes
 * the thumb against that end; it springs back once the wheel stops.
 */
export function ScrollArea({ viewportClassName, viewportRef, scrollbar = true, fade = false, feel: local, className, children, onPointerMove, onPointerLeave, ...rest }: ScrollAreaProps) {
  const { p, t, deform } = useFeel("scrollbar", local);
  const view = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [atEnd, setAtEnd] = useState(true);
  const [near, setNear] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [shown, setShown] = useState(false);

  const thumbY = useAnimated(0);
  const thumbH = useAnimated(0);
  const width = useAnimated(p.idleWidth);
  const over = useAnimated(0);
  const trackH = useAnimated(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const overTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const overRaw = useRef(0);
  /** Which end is being pressed. `over` is a magnitude; the end is remembered separately so a
   * bouncy recovery that dips below zero can't flip the anchor (the thumb used to flash to the top). */
  const overEnd = useRef<1 | -1>(1);
  const jump = useRef<ReturnType<typeof animate> | null>(null);
  const drag = useRef<{ id: number; y: number; top: number; ratio: number } | null>(null);
  const geo = useRef({ len: 0, travel: 0, max: 0 });

  const setView = useCallback((el: HTMLDivElement | null) => {
    view.current = el;
    if (typeof viewportRef === "function") viewportRef(el);
    else if (viewportRef) (viewportRef as { current: HTMLDivElement | null }).current = el;
  }, [viewportRef]);

  /** Thumb rect from scroll position plus the edge squash (anchored to the end it hits). */
  const layout = useCallback(() => {
    const el = view.current;
    if (!el) return;
    const H = el.clientHeight;
    const C = el.scrollHeight;
    const max = Math.max(0, C - H);
    const T = Math.max(0, H - EDGE * 2);
    // The thumb travels inside the track with the same inset on every side.
    const L = Math.max(0, T - p.inset * 2);
    const len = max > 0 ? clamp(L * (H / C), Math.min(p.minThumb, L), L) : L;
    const travel = L - len;
    geo.current = { len, travel, max };
    trackH.set(T);
    // Recovery overshoot (negative) means "no squash", never a squash at the other end.
    const o = Math.max(0, over.mv.get());
    const h = Math.max(Math.min(len, 8), len - o);
    const top = max > 0 ? (el.scrollTop / max) * travel : 0;
    thumbH.set(h);
    thumbY.set(EDGE + p.inset + (o > 0 ? (overEnd.current > 0 ? L - h : 0) : top));
    setScrollable(max > 1);
    setAtEnd(el.scrollTop >= max - 1);
  }, [p.minThumb, p.inset, over.mv, thumbH, thumbY, trackH]);

  useLayoutEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (view.current) ro.observe(view.current);
    if (content.current) ro.observe(content.current);
    return () => ro.disconnect();
  }, [layout]);
  useEffect(() => over.mv.on("change", layout), [over.mv, layout]);
  useEffect(() => () => { clearTimeout(hideTimer.current); clearTimeout(overTimer.current); jump.current?.stop(); }, []);

  const active = near || dragging;
  useEffect(() => {
    width.to(active ? p.hoverWidth : p.idleWidth, t(p.hoverSpring, { exit: !active }));
  }, [active, p.hoverWidth, p.idleWidth, p.hoverSpring, t, width]);

  /** Visible now; fade out after hideDelay unless held open by pointer or drag. */
  const reveal = useCallback(() => {
    setShown(true);
    clearTimeout(hideTimer.current);
    if (p.hideDelay > 0) hideTimer.current = setTimeout(() => setShown(false), p.hideDelay);
  }, [p.hideDelay]);
  useEffect(() => {
    if (active) { clearTimeout(hideTimer.current); setShown(true); }
    else if (shown) reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onScroll = () => { layout(); reveal(); };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    jump.current?.stop();
    const el = view.current;
    const room = p.squash * Math.min(1, deform);
    if (!el || room <= 0 || geo.current.max <= 1) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
    const atTop = el.scrollTop <= 0.5 && dy < 0;
    const atEnd = el.scrollTop >= geo.current.max - 0.5 && dy > 0;
    if (!atTop && !atEnd) return;
    const end = dy > 0 ? 1 : -1;
    if (end !== overEnd.current) { overRaw.current = 0; overEnd.current = end; }
    overRaw.current += Math.abs(dy);
    over.set(room * (1 - Math.exp(-overRaw.current / (room * 6))));
    reveal();
    clearTimeout(overTimer.current);
    overTimer.current = setTimeout(() => { overRaw.current = 0; over.to(0, t(p.recover)); }, 120);
  };

  const barRef = useRef<HTMLDivElement>(null);
  const isNear = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect();
    return !!r && clientX >= r.left - REACH;
  };
  /**
   * While another control is being operated (a button is held for a slider drag, a curve handle, a
   * text selection…) or the pointer sits on another interactive element, the bar must not react —
   * otherwise dragging a slider toward the right edge would grab the scrollbar's hover state.
   */
  const busyElsewhere = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) return false;
    if (e.buttons !== 0) return true;
    const target = e.target as Element | null;
    return !!target && !barRef.current?.contains(target)
      && !!target.closest('[data-at-interactive], button, input, textarea, select, [role="slider"], [contenteditable="true"]');
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    if (e.pointerType !== "mouse" || !scrollable || !scrollbar) return;
    if (busyElsewhere(e)) { if (near) setNear(false); return; }
    if (!shown) reveal();
    const n = isNear(e.clientX);
    if (n !== near) setNear(n);
  };
  const leave = (e: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(e);
    if (!drag.current) setNear(false);
  };

  const thumbDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !view.current) return;
    e.preventDefault();
    e.stopPropagation();
    jump.current?.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { travel, max } = geo.current;
    drag.current = { id: e.pointerId, y: e.clientY, top: view.current.scrollTop, ratio: travel > 0 ? max / travel : 0 };
    setDragging(true);
  };
  const thumbMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !view.current) return;
    view.current.scrollTop = d.top + (e.clientY - d.y) * d.ratio;
  };
  const thumbUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (!isNear(e.clientX)) setNear(false);
  };
  /** Click on the bare track: glide so the thumb centres under the pointer. */
  const trackDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = view.current;
    if (e.button !== 0 || !el || !barRef.current) return;
    e.preventDefault();
    const r = barRef.current.getBoundingClientRect();
    const { len, travel, max } = geo.current;
    const target = travel > 0 ? clamp(((e.clientY - r.top - EDGE - p.inset - len / 2) / travel) * max, 0, max) : 0;
    jump.current?.stop();
    const tr = t(p.jumpSpring);
    if ((tr as { duration?: number }).duration === 0) { el.scrollTop = target; return; }
    jump.current = animate(el.scrollTop, target, { ...(tr as object), onUpdate: (v: number) => { el.scrollTop = v; } } as never);
  };

  const trackW = useTransform(width.mv, (w) => w + p.inset * 2);
  const dotOpacity = useTransform(width.mv, (w) => clamp((w - p.idleWidth) / Math.max(0.5, p.hoverWidth - p.idleWidth), 0, 1));
  const barWidth = p.hoverWidth + p.inset * 2;

  return (
    <div {...rest} className={`at-scroll ${className ?? ""}`} onPointerMove={move} onPointerLeave={leave}
      data-scrollable={scrollable || undefined} data-shown={(scrollable && (shown || active)) || undefined} data-active={active || undefined} data-dragging={dragging || undefined}
      data-fades={fade || undefined}
      data-fade={(fade && scrollable && !atEnd) || undefined}>
      <div ref={setView} className={`at-scroll-view ${viewportClassName ?? ""}`} onScroll={onScroll} onWheel={onWheel}>
        <div ref={content} className="at-scroll-content">{children}</div>
      </div>
{scrollbar && (
      <div ref={barRef} className="at-scroll-bar" aria-hidden data-at-interactive style={{ width: barWidth }} onPointerDown={trackDown}>
        <motion.div className="at-scroll-track" style={{ width: trackW, height: trackH.mv, y: EDGE }} />
        <motion.div className="at-scroll-thumb" style={{ width: width.mv, height: thumbH.mv, y: thumbY.mv }}
          onPointerDown={thumbDown} onPointerMove={thumbMove} onPointerUp={thumbUp} onPointerCancel={thumbUp} onLostPointerCapture={thumbUp}>
          <motion.span className="at-scroll-dot" style={{ opacity: dotOpacity }} />
        </motion.div>
      </div>
      )}
    </div>
  );
}
