import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useFeel } from "../core/feel";
import { IconCheck, IconMinus } from "../core/icons";
import type { ResolvedFeel } from "../core/schema";
import type { ControlSize } from "../tokens/tokens";

export type CheckboxProps = {
  size?: ControlSize;
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  description?: ReactNode;
  name?: string;
  value?: string;
  id?: string;
  "aria-label"?: string;
  feel?: Partial<ResolvedFeel<"checkbox">>;
};

export function Checkbox({ checked, onChange, indeterminate = false, disabled, children, description, name, value, id, size = "md", feel: local, ...aria }: CheckboxProps) {
  const generatedId = useId();
  const input = useRef<HTMLInputElement>(null);
  const { p, t, deform, reduced } = useFeel("checkbox", local);
  useEffect(() => { if (input.current) input.current.indeterminate = indeterminate; }, [indeterminate]);
  const selected = checked || indeterminate;
  return (
    <motion.label className="at-checkbox" data-control-size={size} data-disabled={disabled || undefined} data-at-interactive
      initial={false} whileHover={disabled ? undefined : "hover"} whileTap={disabled ? undefined : "press"}>
      <span className="at-checkbox-control">
        <input ref={input} id={id ?? generatedId} type="checkbox" checked={checked} disabled={disabled} name={name} value={value}
          aria-label={aria["aria-label"]} aria-checked={indeterminate ? "mixed" : checked}
          aria-describedby={description ? `${generatedId}-description` : undefined}
          onChange={e => onChange(e.target.checked)} />
        <motion.span className="at-checkbox-surface" data-selected={selected || undefined} aria-hidden
          variants={{ hover: { scale: 1 + (p.hoverScale - 1) * deform }, press: { scale: 1 - (1 - p.pressScale) * deform } }}
          transition={t(p.spring)}>
          <AnimatePresence initial={false} mode="wait">
            {selected && <motion.span key={indeterminate ? "mixed" : "checked"} className="at-checkbox-mark"
              initial={{ opacity: 0, scale: reduced ? 1 : 0.6, rotate: reduced ? 0 : -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.7 }} transition={t(p.spring)}>
              {indeterminate ? <IconMinus /> : <IconCheck />}
            </motion.span>}
          </AnimatePresence>
        </motion.span>
      </span>
      {(children || description) && <span className="at-checkbox-copy"><span>{children}</span>
        {description && <span id={`${generatedId}-description`} className="at-checkbox-description">{description}</span>}
      </span>}
    </motion.label>
  );
}
