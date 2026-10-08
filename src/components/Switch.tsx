import { useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useTransform } from "motion/react";
import { useFeel } from "../core/feel";
import { softTrack } from "../core/geometry";
import { useAnimated } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";
import { controlHeight, type ControlSize } from "../tokens/tokens";

const W = 28;
const H = 16;
const THUMB = 12;
const PAD = (H - THUMB) / 2;
const MARGIN = PAD + THUMB / 2;
const SPAN = W - MARGIN * 2;

export type SwitchProps = {
  size?: ControlSize;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
  feel?: Partial<ResolvedFeel<"switch">>;
};

/**
 * Switch — 刚性物体在软轨道内移动并被两端吸附 (Handoff §5.6)
 */
export function Switch({ checked, onChange, disabled, size = "md", feel: local, ...rest }: SwitchProps) {
  const BOX = controlHeight(size);
  const { p, t, deform } = useFeel("switch", local);
  const pos = useAnimated(checked ? 1 : 0);
  const hover = useAnimated(0);
  const travel = useMotionValue(0);
  const [isHover, setHover] = useState(false);

  useEffect(() => {
    pos.to(checked ? 1 : 0, t(p.slideSpring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, deform, p.slideSpring, t]);
  useEffect(() => {
    hover.to(isHover && !disabled ? 1 : 0, t(p.slideSpring, { exit: !isHover }));
  }, [isHover, disabled, deform, p.slideSpring, t]);

  useAnimationFrame((_, dt) => {
    const target = Math.min(1, Math.abs(pos.mv.getVelocity()) * SPAN / 90);
    const next = travel.get() + (target - travel.get()) * (1 - Math.exp(-dt / 45));
    travel.set(next < 0.001 ? 0 : next);
  });

  const shape = useTransform([pos.mv, hover.mv, travel] as const, ([f, h, speed]: number[]) => {
    const cx = MARGIN + f * SPAN;
    const squash = Math.min(0.65, p.squash * speed * deform);
    const sc = 1 + (p.thumbHoverScale - 1) * h * Math.min(1, deform);
    const tw = THUMB * sc * (1 + squash);
    const th = THUMB * sc / (1 + squash);
    const bumpHalf = (p.bulgeHeight / 2) * Math.max(h, speed) * deform;
    const res = softTrack({
      left: 0,
      right: W,
      cy: BOX / 2,
      baseHalf: H / 2,
      thumbX0: cx - tw / 2,
      thumbX1: cx + tw / 2,
      thumbHalfH: th / 2,
      thumbR: Math.min(tw, th) / 2,
      bumpCx: cx,
      bumpHalf,
      sigmaL: THUMB * 0.7,
      sigmaR: THUMB * 0.7,
      shrinkHalf: bumpHalf * 0.5,
      minClearance: PAD,
    });
    return { d: res.d, cx, tw, th };
  });
  const d = useTransform(shape, (s) => s.d);
  const thumbX = useTransform(shape, (s) => s.cx - s.tw / 2);
  const thumbY = useTransform(shape, (s) => BOX / 2 - s.th / 2);
  const thumbW = useTransform(shape, (s) => s.tw);
  const thumbH = useTransform(shape, (s) => s.th);
  const thumbR = useTransform(shape, (s) => Math.min(s.tw, s.th) / 2);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="at-switch"
      data-control-size={size}
      data-at-interactive
      data-checked={checked || undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{ width: W, height: BOX }}
      {...rest}
    >
      <svg width={W} height={BOX} className="at-switch-svg" aria-hidden>
        <motion.path className="at-switch-track" d={d} />
        <motion.path className="at-switch-on" d={d} style={{ opacity: pos.mv }} />
        <motion.rect className="at-switch-thumb" x={thumbX} y={thumbY} width={thumbW} height={thumbH} rx={thumbR} />
      </svg>
    </button>
  );
}

export type SwitchFieldProps = {
  size?: ControlSize;
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
  /** region revealed while checked (关联响应) */
  children?: ReactNode;
  feel?: Partial<ResolvedFeel<"switch">>;
};

export function SwitchField({ label, checked, onChange, hint, disabled, children, feel, size = "md" }: SwitchFieldProps) {
  const { p, t } = useFeel("switch", feel);
  const [revealed, setRevealed] = useState(checked);
  const id = useId();
  return (
    <div className="at-switch-field">
      <div className="at-row" data-control-size={size}>
        <label className="at-row-label" htmlFor={id}>
          {label}
          {hint && <span className="at-row-hint">{hint}</span>}
        </label>
        <div className="at-row-control at-row-control-end">
          <Switch size={size} id={id} checked={checked} onChange={onChange} disabled={disabled} feel={feel} />
        </div>
      </div>
      {children !== undefined && (
        <AnimatePresence initial={false}>
          {checked && (
            <motion.div
              className="at-reveal"
              data-revealed={checked && revealed || undefined}
              onAnimationStart={() => setRevealed(false)}
              onAnimationComplete={() => setRevealed(checked)}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1, transition: { height: t(p.revealSpring), opacity: { duration: 0.16, delay: 0.04 } } }}
              exit={{ height: 0, opacity: 0, transition: { height: t(p.revealSpring, { exit: true }), opacity: { duration: 0.1 } } }}
            >
              <div className="at-reveal-inner">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
