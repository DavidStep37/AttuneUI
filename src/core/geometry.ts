/**
 * Geometry helpers for the deformable visual layer.
 * Shapes are described as a horizontal "profile": for each x, a centre line
 * cy(x) and a half-height h(x). The outline is the top edge left→right and the
 * bottom edge right→left.
 */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const gaussian = (x: number, sigma: number) => Math.exp(-(x * x) / (2 * sigma * sigma));

/** polynomial smooth max, k = blend width in px */
export function smoothMax(a: number, b: number, k: number) {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
}

/** Rubber-band: maps overshoot distance to a saturating stretch. */
export function rubber(over: number, resistance: number, max: number) {
  if (max <= 0 || resistance <= 0) return 0;
  const sign = Math.sign(over);
  const a = Math.abs(over) * resistance;
  return sign * max * (1 - Math.exp(-a / max));
}

/** Sample positions: dense near both ends (rounded caps), coarse in the middle. */
export function samples(x0: number, x1: number, capW: number, step = 1.5, capStep = 0.25) {
  const xs: number[] = [];
  const len = x1 - x0;
  if (len <= 0) return [x0, x1];
  const cw = Math.min(capW, len / 2);
  for (let x = x0; x < x0 + cw; x += capStep) xs.push(x);
  for (let x = x0 + cw; x < x1 - cw; x += step) xs.push(x);
  for (let x = x1 - cw; x < x1; x += capStep) xs.push(x);
  xs.push(x1);
  return xs;
}

const f = (v: number) => (Math.round(v * 100) / 100).toString();

export function profilePath(xs: number[], half: (x: number) => number, cy: (x: number) => number) {
  if (xs.length < 2) return "";
  let top = "";
  let bottom = "";
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const h = Math.max(0, half(x));
    const c = cy(x);
    top += `${i === 0 ? "M" : "L"}${f(x)} ${f(c - h)}`;
  }
  for (let i = xs.length - 1; i >= 0; i--) {
    const x = xs[i];
    const h = Math.max(0, half(x));
    bottom += `L${f(x)} ${f(cy(x) + h)}`;
  }
  return `${top}${bottom}Z`;
}

/** Rounded-corner cap: multiplies a body half-height so the shape closes at x0/x1 with radius r. */
export function capHalf(x: number, x0: number, x1: number, bodyHalf: number, r: number) {
  const rr = Math.max(0.001, Math.min(r, bodyHalf, (x1 - x0) / 2));
  let dx = -1;
  if (x < x0 + rr) dx = x - x0;
  else if (x > x1 - rr) dx = x1 - x;
  if (dx < 0) return bodyHalf;
  if (dx <= 0) return 0;
  const k = rr - dx;
  return bodyHalf - rr + Math.sqrt(Math.max(0, rr * rr - k * k));
}

export type SoftTrackInput = {
  left: number; // resting left edge
  right: number; // resting right edge
  cy: number;
  baseHalf: number; // resting half-height
  thumbX0: number; // visual thumb left edge (already includes stretch)
  thumbX1: number; // visual thumb right edge
  thumbHalfH: number; // visual thumb half-height
  thumbR: number; // visual thumb corner radius
  bumpCx: number; // bulge centre
  bumpHalf: number; // extra half-height at bulge centre (already × hover × deform)
  sigmaL: number;
  sigmaR: number;
  shrinkHalf: number; // far-field half-height reduction (volume conservation)
  thin?: number; // whole-body thickness factor (e.g. while stretched)
  minHalf?: number;
};

/**
 * Soft track outline used by Slider and Switch.
 * - bulge: gaussian around bumpCx (asymmetric sigma = trail)
 * - volume conservation: from the crest the track slants down to the ends,
 *   which shrink by shrinkHalf (perspective of a lifted, end-pinned strip)
 * - conformal ends (适形包裹): an end never sits closer to the thumb than the
 *   vertical clearance, and its corner radius is concentric with the thumb's.
 */
export function softTrack(i: SoftTrackInput) {
  const minHalf = i.minHalf ?? 1;
  const thin = i.thin ?? 1;
  // Lifted-in-perspective profile: the lifted crest reads wider, and the track
  // tapers on a slant from the crest down to the pinned ends, which end up
  // narrower than rest (近大远小). u = 0 at the crest → 1 at the resting end.
  const reachL = Math.max(i.sigmaL * 1.5, i.bumpCx - i.left);
  const reachR = Math.max(i.sigmaR * 1.5, i.right - i.bumpCx);
  const body = (x: number) => {
    const d = x - i.bumpCx;
    const g = gaussian(d, d < 0 ? i.sigmaL : i.sigmaR);
    const u = Math.min(1, Math.abs(d) / (d < 0 ? reachL : reachR));
    const h = i.baseHalf + i.bumpHalf * g - i.shrinkHalf * u * (1 - g);
    return Math.max(minHalf, h * thin);
  };
  const tc = (i.thumbX0 + i.thumbX1) / 2;
  const clearance = Math.max(0, body(tc) - i.thumbHalfH);
  const x0 = Math.min(i.left, i.thumbX0 - clearance);
  const x1 = Math.max(i.right, i.thumbX1 + clearance);
  const capR = i.thumbR + clearance;
  const half = (x: number) => capHalf(x, x0, x1, body(x), capR);
  const xs = samples(x0, x1, capR + 1);
  return { d: profilePath(xs, half, () => i.cy), x0, x1, clearance };
}

/** Cubic bezier easing evaluation (CSS semantics). */
export function bezierEasing(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return t;
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (x > v) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

/** Estimate a spring's settle time (stiffness/damping, mass 1) in ms. */
export function springSettleMs(stiffness: number, damping: number, mass = 1) {
  let x = 0;
  let v = 0;
  const dt = 1 / 240;
  let still = 0;
  for (let t = 0; t < 10; t += dt) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    if (Math.abs(x - 1) < 0.005 && Math.abs(v) < 0.05) {
      still += dt;
      if (still > 0.05) return Math.round((t - 0.05) * 1000);
    } else still = 0;
  }
  return 10000;
}

export function roundTo(v: number, step: number) {
  const r = Math.round(v / step) * step;
  const dec = decimals(step);
  return Number(r.toFixed(dec));
}

export function decimals(step: number) {
  const s = step.toString();
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}
