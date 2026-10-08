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
  minClearance?: number; // minimum space around the actual thumb silhouette
};

/**
 * Soft track outline used by Switch.
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
  const clearance = Math.max(i.minClearance ?? 0, body(tc) - i.thumbHalfH);
  const x0 = Math.min(i.left, i.thumbX0 - clearance);
  const x1 = Math.max(i.right, i.thumbX1 + clearance);
  const capR = i.thumbR + clearance;
  const shellLeft = i.thumbX0 - clearance;
  const shellRight = i.thumbX1 + clearance;
  const shellHalf = i.thumbHalfH + clearance;
  const shoulderGate = (distance: number) => {
    const u = clamp(distance / 4, 0, 1);
    return u * u * (3 - 2 * u);
  };
  const half = (x: number) => {
    const rail = capHalf(x, x0, x1, body(x), capR);
    // Offset the thumb's real capsule, rather than tapering its exposed cap
    // with the Gaussian body. This keeps the far arc concentric on either end.
    const shell = x <= shellLeft || x >= shellRight ? 0 : capHalf(x, shellLeft, shellRight, shellHalf, capR);
    const blend = Math.min(1, i.bumpHalf) * Math.min(1, rail, shell)
      * shoulderGate(Math.abs(x - tc))
      * shoulderGate(x - i.left - i.baseHalf)
      * shoulderGate(i.right - i.baseHalf - x);
    return smoothMax(rail, shell, blend);
  };
  const xs = samples(x0, x1, capR + 1, 0.5, 0.125);
  return { d: profilePath(xs, half, () => i.cy), x0, x1, clearance, half };
}

/** Slider has two nested surfaces. The fill ends in a rounded head around the
 * thumb; it is not a rectangular crop of the outer track. */
// 20px fill + 2px shell on each side matches the 24px default Input.
export const SLIDER_INNER_HALF = 10;
export const SLIDER_DOT = 4;

export function snapSliderValue(value: number, min: number, max: number, step: number) {
  if (value <= min) return min;
  if (value >= max) return max;
  if (step <= 0) return clamp(value, min, max);
  const snapped = min + roundTo(value - min, step);
  return clamp(Number(snapped.toFixed(Math.min(15, Math.max(decimals(min), decimals(step))))), min, max);
}

export type NestedSliderInput = {
  width: number;
  progress: number;
  focus: number;
  deform: number;
  velocity: number;
  gap: number;
  bulgeHeight: number;
  bulgeWidth: number;
  thumbHoverScale: number;
  endInset: number;
  neckDepth: number;
  trail: number;
  stretchL: number;
  stretchR: number;
};

export function nestedSlider(i: NestedSliderInput) {
  const width = Math.max(1, i.width);
  const progress = clamp(i.progress, 0, 1);
  const gap = Math.max(1, i.gap);
  const outerRest = SLIDER_INNER_HALF + gap;
  const margin = Math.min(outerRest, width / 2);
  const span = Math.max(0, width - margin * 2);
  const focus = clamp(i.focus, 0, 1.15) * Math.max(0, i.deform);
  // Shrink only the resting dot; retain the established expanded size.
  const dotSize = lerp(SLIDER_DOT, 6 * i.thumbHoverScale, focus);
  const stretch = Math.max(0, i.stretchL + i.stretchR);
  // Only overscroll applies tension: ~10.6% at an 8px pull, bounded at 16%.
  const tensionScale = 1 - 0.16 * Math.tanh(stretch / 10);
  const thumbW = dotSize + stretch * 0.55;
  const thumbRestH = dotSize / Math.sqrt(1 + stretch / 24);
  const thumbH = thumbRestH * tensionScale;
  const cx = margin + progress * span + (i.stretchR - i.stretchL) * 0.5;
  // Leave room for the dot even when the user reduces bulgeHeight independently.
  const bump = Math.max(i.bulgeHeight * 0.5 * focus, thumbRestH / 2 + 2 - SLIDER_INNER_HALF, 0);
  const headHalf = (SLIDER_INNER_HALF + bump) * tensionScale;
  const shellGap = gap * tensionScale;
  const flatHalf = Math.max(0, (thumbW - thumbH) / 2);
  const headRX = headHalf + flatHalf;
  const left = Math.min(-i.stretchL, cx - headRX - shellGap);
  const right = Math.max(width + i.stretchR, cx + headRX + shellGap);
  const speed = Math.tanh(i.velocity / 420);
  const trail = Math.min(0.3, i.trail * 0.3) * speed * Math.min(1, focus);
  // A compact shoulder sized to the head, independent of selected length.
  const sigma = Math.max(8, (SLIDER_INNER_HALF + bump) * 1.3 * i.bulgeWidth / 3);
  const sigmaL = Math.max(4, sigma * (1 + trail));
  const sigmaR = Math.max(4, sigma * (1 - trail * 0.5));
  // Stretched past an extreme, the thumb becomes a capsule with a flat middle.
  // The crest stretches with it (flat-topped gaussian), so the rail keeps
  // carrying the capsule's sides instead of meeting its round end at an angle.
  const crestFlat = Math.max(0, (thumbW - thumbH) / 2);
  const crest = (x: number) => gaussian(Math.max(0, Math.abs(x - cx) - crestFlat), x < cx ? sigmaL : sigmaR);

  // Both ends share a fixed thickness. A shallow, symmetric neck dips below
  // that thickness and rises back to each end; no stored volume or strain.
  const endInset = clamp(i.endInset, 0, 3) * Math.min(1, focus);
  const neckDepth = clamp(i.neckDepth, 0, 2) * Math.min(1, focus);
  const body = (x: number) => {
    const g = crest(x);
    const reach = x < cx ? cx - left : right - cx;
    const u = clamp(Math.abs(x - cx) / Math.max(1, reach), 0, 1);
    const neck = neckDepth * Math.sin(Math.PI * u) ** 2;
    return (outerRest + bump * g - (endInset + neck) * (1 - g)) * tensionScale;
  };

  // Elliptical caps have a vertical tangent at the tip and a horizontal tangent
  // at the body join. Unlike capHalf, they never close with a tiny vertical seam.
  const cap = (x: number, x0: number, x1: number, rl: number, rr: number) => {
    if (x <= x0 || x >= x1) return 0;
    const length = x1 - x0;
    const k = Math.min(1, length / Math.max(0.01, rl + rr));
    const l = Math.max(0.001, rl * k);
    const r = Math.max(0.001, rr * k);
    if (x < x0 + l) return Math.sqrt(Math.max(0, 1 - ((x - x0 - l) / l) ** 2));
    if (x > x1 - r) return Math.sqrt(Math.max(0, 1 - ((x - x1 + r) / r) ** 2));
    return 1;
  };
  // Offset the actual capsule silhouette. Union it with the soft rail everywhere:
  // the rail dominates in the middle; the capsule naturally owns exposed ends.
  // No min/max position branch is needed for conformal wrapping.
  const capsule = (x: number, radius: number) => {
    const dx = Math.max(0, Math.abs(x - cx) - flatHalf);
    return Math.sqrt(Math.max(0, radius * radius - dx * dx));
  };
  // Blend the shoulder over a finite band, tapering to zero at the capsule's
  // flat section so its top and bottom remain parallel to the stretched thumb.
  const smoothGate = (v: number) => {
    const u = clamp(v, 0, 1);
    return u * u * (3 - 2 * u);
  };
  const shoulderBlend = (x: number, rail: number, head: number) =>
    2.5 * focus * smoothGate((Math.abs(x - cx) - flatHalf) / 8)
      * smoothGate(rail / 2.5) * smoothGate(head / 2.5);
  const outerEnvelope = (x: number) => {
    const rail = body(x) * cap(x, left, right, body(left), body(right));
    // The shell wraps the round head even near the ends or with a narrow
    // shoulder. Blend the contact instead of flattening/clipping the circle.
    const head = capsule(x, headHalf + shellGap);
    return smoothMax(rail, head, shoulderBlend(x, rail, head));
  };
  const outerHalf = outerEnvelope;
  const fillLeft = left + shellGap;
  const fillRight = Math.min(right - shellGap, cx + headRX);
  const innerHalf = (x: number) => {
    const head = capsule(x, headHalf);
    const rail = (body(x) - shellGap) * cap(x, fillLeft, fillRight, Math.max(1, body(fillLeft) - shellGap), headRX);
    const envelope = x >= cx
      ? head
      : smoothMax(head, rail, shoulderBlend(x, rail, head));
    return Math.max(0, Math.min(envelope, outerEnvelope(x) - shellGap));
  };
  const outerPath = profilePath(samples(left, right, Math.max(outerRest, headRX + gap) + 1, 0.8, 0.2), outerHalf, () => 14);
  // Use SVG arcs for the exposed head, so the tip stays round at any zoom.
  const fillXs = samples(fillLeft, cx, headRX + 1, 0.8, 0.2);
  const fillTop = fillXs.map((x, n) => `${n === 0 ? "M" : "L"}${f(x)} ${f(14 - innerHalf(x))}`).join("");
  const fillBottom = [...fillXs].reverse().map((x) => `L${f(x)} ${f(14 + innerHalf(x))}`).join("");
  const capCx = cx + flatHalf;
  // The opaque head remains behind the thumb even at min. Progress changes
  // the selected length, never its color or opacity.
  const fillPath = `${fillTop}L${f(capCx)} ${f(14 - headHalf)}A${f(headHalf)} ${f(headHalf)} 0 0 1 ${f(fillRight)} 14A${f(headHalf)} ${f(headHalf)} 0 0 1 ${f(capCx)} ${f(14 + headHalf)}${fillBottom}Z`;
  return { outerPath, fillPath, cx, thumbW, thumbH, left, right, fillLeft, fillRight, outerHalf, innerHalf };
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
