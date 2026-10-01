import { useRef, type ButtonHTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { useFeel } from "../core/feel";
import { clamp } from "../core/geometry";
import { useAnimated } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  icon?: ReactNode;
  iconOnly?: boolean;
  feel?: Partial<ResolvedFeel<"button">>;
};

/**
 * Button — 磁铁被吸引；受压倾斜的平衡木板 (Handoff §5.4)
 * The whole element translates, so the hit area moves with what you see (所见即所得).
 * Tilt lives on the visual surface layer only — text is never rotated.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly,
  feel: local,
  children,
  className,
  onPointerMove,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onKeyDown,
  onKeyUp,
  disabled,
  ...rest
}: ButtonProps) {
  const { p, t, deform, passive } = useFeel("button", local);
  const ref = useRef<HTMLButtonElement>(null);
  const x = useAnimated(0);
  const y = useAnimated(0);
  const rx = useAnimated(0);
  const ry = useAnimated(0);
  const sc = useAnimated(1);
  const pressed = useRef(false);
  const last = useRef({ nx: 0, ny: 0 });

  const rel = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    // measure against the un-translated rect so attraction doesn't feed back
    const cx = r.left + r.width / 2 - x.mv.get();
    const cy = r.top + r.height / 2 - y.mv.get();
    return {
      nx: clamp((e.clientX - cx) / (r.width / 2), -1, 1),
      ny: clamp((e.clientY - cy) / (r.height / 2), -1, 1),
    };
  };

  const aim = (nx: number, ny: number) => {
    const tr = t(p.hoverSpring);
    const k = passive * deform;
    const pressK = pressed.current ? 1 : 0;
    x.to(nx * p.attract * k, tr);
    y.to(ny * p.attract * k * 0.6, tr);
    // pointer side sinks; press adds a stronger tilt toward the pressed point
    const tilt = p.tilt * k + p.pressTilt * deform * pressK;
    ry.to(nx * tilt, tr);
    rx.to(-ny * tilt, tr);
  };

  const rest0 = () => {
    const tr = t(p.recover);
    x.to(0, tr);
    y.to(0, tr);
    rx.to(0, tr);
    ry.to(0, tr);
    sc.to(1, tr);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`at-btn ${className ?? ""}`}
      data-variant={variant}
      data-size={size}
      data-icon-only={iconOnly || undefined}
      data-at-interactive
      disabled={disabled}
      style={{ x: x.mv, y: y.mv }}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        if (disabled || e.pointerType === "touch") return;
        const r = rel(e);
        last.current = r;
        aim(r.nx, r.ny);
      }}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        pressed.current = false;
        rest0();
      }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (disabled || e.button !== 0) return;
        pressed.current = true;
        const r = rel(e);
        last.current = r;
        aim(r.nx, r.ny);
        sc.to(1 - (1 - p.pressScale) * Math.min(1, deform || 0), t(p.hoverSpring));
      }}
      onPointerUp={(e) => {
        onPointerUp?.(e);
        pressed.current = false;
        sc.to(1, t(p.recover));
        aim(last.current.nx, last.current.ny);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(e);
        if ((e.key === " " || e.key === "Enter") && !e.repeat) sc.to(1 - (1 - p.pressScale) * Math.min(1, deform || 0), t(p.hoverSpring));
      }}
      onKeyUp={(e: KeyboardEvent<HTMLButtonElement>) => {
        onKeyUp?.(e);
        sc.to(1, t(p.recover));
      }}
      onBlur={rest0}
      {...(rest as object)}
    >
      <motion.span
        className="at-btn-surface"
        aria-hidden
        style={{ rotateX: rx.mv, rotateY: ry.mv, scale: sc.mv, transformPerspective: 240 }}
      />
      <span className="at-btn-label">
        {icon && <span className="at-btn-icon">{icon}</span>}
        {!iconOnly && children}
      </span>
    </motion.button>
  );
}
