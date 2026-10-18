import { useLayoutEffect, useRef } from "react";
import { motion, useTransform } from "motion/react";
import { useFeelState } from "../core/feel";
import { useAnimated } from "../core/hooks";
import { ease, valueRoll } from "../tokens/tokens";

const modulo = (n: number) => ((n % 10) + 10) % 10;

/** Keys describe decimal places, so adding a leading digit never remounts units. */
function columns(text: string) {
  const decimal = text.indexOf(".");
  const split = decimal < 0 ? text.length : decimal;
  let place = [...text.slice(0, split)].filter(c => /\d/.test(c)).length;
  let fraction = 0;
  return [...text].map((char, index) => {
    if (/\d/.test(char)) return { char, key: `digit:${index < split ? --place : --fraction}`, digit: true };
    return { char, key: `symbol:${char}:${place}:${fraction}`, digit: false };
  });
}

function Digit({ digit, value, reduced, duration }: { digit: number; value: number; reduced: boolean; duration: number }) {
  const position = useAnimated(digit);
  const previous = useRef({ digit, value });
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { digit, value };
    if (reduced) {
      position.set(digit);
      return;
    }
    if (digit === before.digit) return;
    const direction = Math.sign(value - before.value) || Math.sign(digit - before.digit);
    // Wrap 9 → 0 forward, 0 → 9 backward. Interrupt at the displayed fraction
    // rather than resetting the strip to the previous logical digit.
    const current = position.mv.get();
    const target = direction > 0
      ? current + modulo(digit - modulo(current))
      : current - modulo(modulo(current) - digit);
    position.to(target, { duration: duration / 1000, ease: ease.out });
  }, [digit, value, reduced, duration, position.mv, position.set, position.to]);

  // Three repeated turns keep the modulo seam invisible in either direction.
  const y = useTransform(position.mv, p => `${-(10 + modulo(p)) * 100}%`);
  const filter = useTransform(position.mv, p => {
    const blur = Math.sin(Math.PI * p) ** 2 * valueRoll.blur;
    return blur > 0.01 ? `blur(${blur}px)` : "none";
  });
  return <span className="at-roll-digit" data-digit={digit}>
    <motion.span className="at-roll-strip" style={{ y: reduced ? `${-(10 + digit) * 100}%` : y, filter: reduced ? "none" : filter }}>
      {Array.from({ length: 30 }, (_, i) => <span key={i} style={{ top: `${i * 100}%` }}>{i % 10}</span>)}
    </motion.span>
  </span>;
}

/** Independent digit wheels; separators and unchanged places stay stationary. */
export function ValueRoll({ value, text, className, duration = valueRoll.duration }: {
  value: number; text: string; className?: string; duration?: number;
}) {
  const { reduced } = useFeelState();
  return <span className={`at-roll ${className ?? ""}`}>
    <span className="at-roll-readable">{text}</span>
    <span className="at-roll-inner" aria-hidden>
      {columns(text).map(column => column.digit
        ? <Digit key={column.key} digit={Number(column.char)} value={value} reduced={reduced} duration={duration} />
        : <span key={column.key} className="at-roll-symbol">{column.char}</span>)}
    </span>
  </span>;
}
