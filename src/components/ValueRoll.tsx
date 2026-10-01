import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useFeelState } from "../core/feel";
import { duration, ease, valueRoll } from "../tokens/tokens";

/**
 * Rolling number (Handoff §4.7 rule 8).
 * Value up → rolls upward, down → rolls downward, with a light blur.
 * Rapid continuous changes (dragging) only blur slightly instead of rolling per frame.
 */
export function ValueRoll({ value, text, className }: { value: number; text: string; className?: string }) {
  const { reduced } = useFeelState();
  const [layers, setLayers] = useState<{ key: number; text: string; dir: number }[]>([{ key: 0, text, dir: 0 }]);
  const prev = useRef({ value, text, t: 0 });
  const keyRef = useRef(0);
  const blur = useMotionValue(0);
  const nudge = useMotionValue(0);
  const filter = useTransform(blur, (b) => (b > 0.05 ? `blur(${b}px)` : "none"));
  const y = useTransform(nudge, (v) => `${v}em`);

  useEffect(() => {
    const p = prev.current;
    if (text === p.text) return;
    const now = performance.now();
    const dir = value > p.value ? 1 : value < p.value ? -1 : 0;
    const rapid = now - p.t < 90;
    prev.current = { value, text, t: now };
    if (reduced || dir === 0) {
      setLayers([{ key: ++keyRef.current, text, dir: 0 }]);
      return;
    }
    if (rapid) {
      // continuous mode: swap text, light blur + tiny nudge in the direction
      setLayers([{ key: keyRef.current, text, dir: 0 }]);
      blur.set(Math.min(valueRoll.blur * 0.6, blur.get() + 0.5));
      nudge.set(dir * 0.08);
      animate(blur, 0, { duration: duration.fast / 1000, ease: ease.out });
      animate(nudge, 0, { duration: duration.fast / 1000, ease: ease.out });
      return;
    }
    setLayers((ls) => {
      const cur = ls[ls.length - 1];
      return [{ ...cur, dir: -dir }, { key: ++keyRef.current, text, dir }];
    });
  }, [text, value, reduced, blur, nudge]);

  const d = valueRoll.distance;
  const tr = { duration: duration.fast / 1000, ease: ease.out };
  return (
    <span className={`at-roll ${className ?? ""}`}>
      <motion.span className="at-roll-inner" style={{ filter, y }}>
        {layers.map((l, i) => {
          const exiting = i < layers.length - 1;
          if (exiting) {
            // l.dir holds the exit direction (negative of incoming)
            return (
              <motion.span
                key={l.key}
                className="at-roll-layer at-roll-exit"
                initial={{ y: "0em", opacity: 1, filter: "blur(0px)" }}
                animate={{ y: `${l.dir * d}em`, opacity: 0, filter: `blur(${valueRoll.blur}px)` }}
                transition={tr}
                onAnimationComplete={() => setLayers((ls) => ls.filter((x) => x.key !== l.key))}
                aria-hidden
              >
                {l.text}
              </motion.span>
            );
          }
          return (
            <motion.span
              key={l.key}
              className="at-roll-layer"
              initial={l.dir ? { y: `${l.dir * d}em`, opacity: 0, filter: `blur(${valueRoll.blur}px)` } : false}
              animate={{ y: "0em", opacity: 1, filter: "blur(0px)" }}
              transition={tr}
            >
              {l.text}
            </motion.span>
          );
        })}
      </motion.span>
    </span>
  );
}
