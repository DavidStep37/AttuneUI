// Node 22: node --experimental-strip-types scripts/test-radial-geometry.mjs
// RadialPicker tiles: the gap between neighbouring tiles must be constant from
// hub to rim (parallel sides), equal to the gap to the hub and to the rim, for
// any number of options and with the hover swell applied.
import assert from "node:assert/strict";
import { annularSector, gaussian } from "../src/core/geometry.ts";

const TAU = Math.PI * 2;
const distToSeg = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const distToPoly = (p, poly) => {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distToSeg(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
};
const angDiff = (a, b) => { const d = (((a - b) % TAU) + TAU) % TAU; return d > Math.PI ? d - TAU : d; };

const R = 124, r0 = 44, corner = 7, baseStroke = 0.5, steps = 24;
let cases = 0;
for (const gap of [2.5, 4]) {
  for (const n of [3, 4, 5, 6, 8]) {
    for (const swell of [0, 6, 12]) {
      const arc = TAU / n;
      const hoverAt = -Math.PI / 2 + arc * 0.3; // off-centre, so neighbours see different rims
      const rim = (a) => R + swell * gaussian(angDiff(a, hoverAt), arc * 0.5);
      const tile = (i) => annularSector({ cx: 0, cy: 0, mid: -Math.PI / 2 + i * arc, half: arc / 2, rIn: r0 + gap + corner, rOut: (a) => rim(a) - baseStroke - gap - corner, side: gap / 2 + corner, steps });
      for (let i = 0; i < n; i++) {
        const a = tile(i), b = tile((i + 1) % n);
        assert(a.length > 0 && b.length > 0, "tiles exist");
        // a's right side runs from its last outer point to its first inner point
        const p0 = a[steps], p1 = a[steps + 1];
        let lo = Infinity, hi = 0;
        // compare over the stretch where both tiles have a straight side
        const [q0, q1] = [b[0], b[b.length - 1]];
        const rMax = Math.min(Math.hypot(...p0), Math.hypot(...q0)) - 0.5;
        const rMin = Math.max(Math.hypot(...p1), Math.hypot(...q1)) + 0.5;
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          const p = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
          const r = Math.hypot(...p);
          if (r > rMax || r < rMin) continue;
          const visible = distToPoly(p, b) - 2 * corner; // both outlines are offset by `corner`
          lo = Math.min(lo, visible); hi = Math.max(hi, visible);
        }
        assert(lo > gap - 0.05 && hi < gap + 0.05, `neighbour gap ${lo.toFixed(3)}–${hi.toFixed(3)} ≠ ${gap} (n=${n}, swell=${swell})`);
        // inner arc → hub edge, outer arc → inside of the base border
        for (const pt of a.slice(steps + 1)) assert(Math.abs(Math.hypot(...pt) - corner - r0 - gap) < 1e-6, "hub gap");
        for (const pt of a.slice(0, steps + 1)) {
          const ang = Math.atan2(pt[1], pt[0]);
          assert(Math.abs(rim(ang) - baseStroke - (Math.hypot(...pt) + corner) - gap) < 1e-6, "rim gap");
        }
        cases++;
      }
    }
  }
}
console.log(`PASS radial tiles: neighbour, hub and rim gaps all equal the configured gap (${cases} tile pairs, 3–8 options, with swell)`);
