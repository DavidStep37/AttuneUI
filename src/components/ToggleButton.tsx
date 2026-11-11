import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { springTransition, useFeelState } from "../core/feel";
import { IconClose } from "../core/icons";
import { Button, type ButtonProps } from "./Button";

export type ToggleButtonProps = Omit<ButtonProps, "variant" | "iconOnly" | "onChange" | "onClick" | "children"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /** Label while off. Omit for an icon-only button that sits among other icon buttons. */
  children?: ReactNode;
  /** Label while on (e.g. "启用预设"); defaults to `children`. */
  pressedLabel?: ReactNode;
  /** Base look; on adds a light graphite tint and a stronger outline (selected without shouting). */
  variant?: "secondary" | "ghost";
};

/**
 * ToggleButton — a switch that looks like a button, for a toolbar row of buttons.
 * Reuses Button entirely (shape, magnet/tilt, press, feel params `button.*`). Off: a normal
 * (optionally icon-only) button. On: a light graphite-tinted fill + stronger outline, the label and a trailing ×
 * slide open from the icon. Clicking anywhere toggles; the × marks “click to turn off”.
 * Exposed as a native toggle button (`aria-pressed`).
 */
export function ToggleButton({ pressed, onPressedChange, children, pressedLabel, variant = "secondary", icon, className, size = "md", ...rest }: ToggleButtonProps) {
  const { springs, reduced } = useFeelState();
  const onLabel = pressedLabel ?? children;
  const collapsed = !pressed && !children && !!icon;
  const spring = springTransition(springs.snappy, reduced);
  return (
    <Button
      {...rest}
      size={size}
      icon={icon}
      variant={variant}
      aria-pressed={pressed}
      className={`at-toggle-btn ${className ?? ""}`}
      data-pressed={pressed || undefined}
      data-collapsed={collapsed || undefined}
      onClick={() => onPressedChange(!pressed)}
    >
      {/* Off label (if any) and on label + × share one animated slot, so width changes smoothly. */}
      <AnimatePresence initial={false}>
        {(pressed || children) && (
          <motion.span
            key={pressed ? "on" : "off"}
            className="at-toggle-btn-text"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1, transition: { width: spring, opacity: { duration: reduced ? 0 : 0.14, delay: reduced ? 0 : 0.04 } } }}
            exit={{ width: 0, opacity: 0, transition: { width: springTransition(springs.snappy, reduced, { exit: true }), opacity: { duration: reduced ? 0 : 0.08 } } }}
          >
            <span className="at-toggle-btn-label">{pressed ? onLabel : children}</span>
            {pressed && <span className="at-toggle-btn-close" aria-hidden><IconClose /></span>}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
