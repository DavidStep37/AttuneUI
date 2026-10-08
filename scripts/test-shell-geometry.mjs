// Node 22: node --experimental-strip-types scripts/test-shell-geometry.mjs
// Button shell + core must be conformal: the visible gap is the same all round
// (ends, corners and over the pointer swell), and nothing is NaN.
import assert from "node:assert/strict";
import { shellCore } from "../src/core/geometry.ts";

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

let cases = 0;
for (const [width, height] of [[68, 28], [44, 24], [120, 32], [28, 28]]) {
  for (const radius of [6, height / 2]) {
    for (const bulgeX of [0, width * 0.25, width / 2, width]) {
      for (const bulge of [0, 3, 6]) {
        const inset = 2.5;
        const s = shellCore({ width, height, radius, inset, bulge, bulgeX, sigma: height * 0.6 });
        assert(!/NaN|Infinity/.test(s.shellPath + s.corePath), "finite geometry");
        let lo = Infinity, hi = 0;
        for (const p of s.core) {
          const d = distToPoly(p, s.shell);
          lo = Math.min(lo, d); hi = Math.max(hi, d);
        }
        assert(lo > inset - 0.25 && hi < inset + 0.25, `uniform gap ${lo.toFixed(2)}–${hi.toFixed(2)} (w${width} h${height} r${radius} x${bulgeX} b${bulge})`);
        cases++;
      }
    }
  }
}

// At rest (no inset, no swell) the shell and core coincide with the button rect.
{
  const s = shellCore({ width: 68, height: 28, radius: 14, inset: 0, bulge: 0, bulgeX: 34, sigma: 17 });
  const ys = s.shell.map((p) => p[1]);
  const xs = s.shell.map((p) => p[0]);
  assert(Math.abs(Math.min(...ys)) < 0.05 && Math.abs(Math.max(...ys) - 28) < 0.05, "rest shell spans the full height");
  assert(Math.abs(Math.min(...xs)) < 0.05 && Math.abs(Math.max(...xs) - 68) < 0.05, "rest shell spans the full width");
}

// The swell lifts both surfaces together around the pointer.
{
  const a = shellCore({ width: 68, height: 28, radius: 14, inset: 2.5, bulge: 3, bulgeX: 20, sigma: 17 });
  const top = (poly, x) => Math.min(...poly.filter((p) => Math.abs(p[0] - x) < 0.6).map((p) => p[1]));
  assert(top(a.core, 20) < top(a.core, 60) - 1.5, "core rises at the pointer");
  assert(top(a.shell, 20) < 0, "shell is lifted beyond the button at the pointer");
}

console.log(`PASS shell+core: constant gap all round (${cases} cases), exact rest outline, swell lifts both layers`);
