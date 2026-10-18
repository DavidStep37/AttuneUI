import { useRef } from "react";
import { motion, useAnimationFrame, useMotionValue, type MotionValue } from "motion/react";
import { bezierSideEdges, bezierSidePath } from "../core/bezierSides";
import type { SpringToken } from "../tokens/tokens";

/** Two independent surfaces: contact pushes them away; release closes the
 * vacant space. Keep the visible contours when a settling gesture is interrupted. */
export function BezierSides({ values, dragging, size, x, y, reduced, spring }: {
  values: MotionValue<number>[]; dragging: { current: number }; size: number; x: number; y: number;
  reduced: boolean; spring: SpringToken;
}) {
  const state = useRef<{ key: string; size: number; edges: ReturnType<typeof bezierSideEdges>;
    target: ReturnType<typeof bezierSideEdges>; speed: number[][] } | null>(null);
  if (!state.current || state.current.size !== size) {
    const edges = bezierSideEdges(values.map(v => v.get()), size);
    state.current = { key: '', size, edges, target: edges, speed: [edges.upper.map(() => 0), edges.lower.map(() => 0)] };
  }
  const upper = useMotionValue(bezierSidePath(state.current.edges.upper, size, true));
  const lower = useMotionValue(bezierSidePath(state.current.edges.lower, size, false));
  useAnimationFrame((_, delta) => {
    const s = state.current!, curve = values.map(v => v.get()), key = curve.join(',');
    if (key === s.key && (dragging.current || (['upper', 'lower'] as const).every((name, side) =>
      s.edges[name].every((v, i) => v === s.target[name][i] && s.speed[side][i] === 0)))) return;
    if (key !== s.key) { s.target = bezierSideEdges(curve, size); s.key = key; }
    const dt = Math.min(delta / 1000, 0.04);
    const omega = 6 / Math.max(0.12, spring.visualDuration);
    const damping = 2 * omega * (1 - Math.min(0.8, spring.bounce) * 0.5);
    for (const [side, name] of (['upper', 'lower'] as const).entries()) {
      s.edges[name] = s.edges[name].map((value, i) => {
        const target = s.target[name][i];
        if (reduced) { s.speed[side][i] = 0; return target; }
        if (dragging.current) {
          s.speed[side][i] = 0;
          return side === 0 ? Math.min(value, target) : Math.max(value, target);
        }
        let velocity = s.speed[side][i];
        for (let step = 0; step < 5; step++) {
          velocity += ((target - value) * omega * omega - damping * velocity) * dt / 5;
          value += velocity * dt / 5;
        }
        // Contact never crosses the required clearance, including spring overshoot.
        if ((side === 0 && value > target) || (side === 1 && value < target)
          || (Math.abs(value - target) < 0.001 && Math.abs(velocity) < 0.01)) { value = target; velocity = 0; }
        s.speed[side][i] = velocity;
        return value;
      });
    }
    upper.set(bezierSidePath(s.edges.upper, size, true));
    lower.set(bezierSidePath(s.edges.lower, size, false));
  });
  return <g transform={`translate(${x} ${y})`} aria-hidden="true" pointerEvents="none">
    <motion.path className="at-bezier-side" data-side="upper" d={upper} />
    <motion.path className="at-bezier-side" data-side="lower" d={lower} />
  </g>;
}
