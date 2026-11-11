/**
 * Geometry helpers for the deformable visual layer.
 * Shapes are described as a horizontal "profile": for each x, a centre line
 * cy(x) and a half-height h(x). The outline is the top edge left→right and the
 * bottom edge right→left.
 */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const gaussian = (x: number, sigma: number) => Math.exp(-(x * x) / (2 * sigma * sigma));

/**
 * Cubic smooth max, k = blend width in px. Curvature-continuous (C2): the
 * blend fades out without a curvature jump, so seams never read as a bend.
 * (The quadratic version is only C1 and leaves a visibly "hard" shoulder.)
 */
export function smoothMax(a: number, b: number, k: number) {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * h * k) / 6;
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
  const bottomPoints = new Array<string>(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const h = Math.max(0, half(x));
    const c = cy(x);
    top += `${i === 0 ? "M" : "L"}${f(x)} ${f(c - h)}`;
    bottomPoints[i] = `L${f(x)} ${f(c + h)}`;
  }
  for (let i = xs.length - 1; i >= 0; i--) {
    bottom += bottomPoints[i];
  }
  return `${top}${bottom}Z`;
}

/** Separate edges let a neighbour yield on its near side without moving its far side. */
export function edgeProfilePath(xs: number[], top: (x: number) => number, bottom: (x: number) => number) {
  if (xs.length < 2) return "";
  return xs.map((x, i) => `${i ? "L" : "M"}${f(x)} ${f(top(x))}`).join("")
    + [...xs].reverse().map(x => `L${f(x)} ${f(bottom(x))}`).join("") + "Z";
}

/** Leave small lifts intact; approach the ceiling with C2 continuity rather
 * than clipping a flat plateau or introducing a hard bend into the contour. */
function limitTimelineLift(value: number, limit: number) {
  if (limit <= 0) return 0;
  const magnitude = Math.abs(value), knee = limit * 0.75;
  if (magnitude <= knee) return value;
  const span = limit - knee, t = (magnitude - knee) / span;
  return Math.sign(value) * (knee + span * t / Math.hypot(1, t));
}

/** The intrinsic bar contour, before neighbours push it. Drawing and pressure
 * share this exact shape, including press spread, resize thickness and pluck. */
export function timelineBarProfile(i: {
  left: number; right: number; minX: number; maxX: number; cy: number; baseHalf: number;
  spread: number; thin: number; bulge: number; bulgeX: number; sigma: number;
  pluck: number; pluckX: number; maxLift: number;
}) {
  const left = clamp(i.left - i.spread, i.minX, i.maxX);
  const right = clamp(i.right + i.spread, left, i.maxX);
  const length = Math.max(1, right - left);
  // A very narrow ellipse has less room for extra height. Tighten smoothly
  // below one resting bar-height of width, without changing its layout slot.
  const widthRatio = clamp((right - left) / Math.max(1, i.baseHalf * 2), 0, 1);
  const maxLift = Math.max(0, i.maxLift);
  const widthLimit = maxLift * widthRatio ** 3 * (widthRatio * (6 * widthRatio - 15) + 10);
  // Bound the combined outward motion, including resize thickness and pluck.
  // One gain for the whole profile preserves its curved crest and closed caps.
  const pressLift = i.spread * 0.5;
  const demand = Math.max(0, pressLift) + Math.max(0, i.baseHalf + pressLift) * Math.max(0, i.thin - 1)
    + Math.max(0, i.bulge) + Math.abs(i.pluck);
  const liftScale = demand > 0 ? limitTimelineLift(demand, widthLimit) / demand : 1;
  const gate = (x: number) => {
    const u = clamp(Math.min(x - left, right - x) / Math.max(1, Math.min(i.baseHalf, length / 2)), 0, 1);
    return u * u * u * (u * (6 * u - 15) + 10);
  };
  // Compare corresponding points on the cap after horizontal spread. Comparing
  // against the old x endpoints mistakes sideways travel for a tall vertical
  // bulge and produces a pressure spike at each old endpoint.
  const capRadius = Math.max(0.001, Math.min(i.baseHalf, (right - left) / 2));
  const baseHalf = (x: number) => x <= left || x >= right ? 0
    : capHalf(x, left, right, capRadius, capRadius) * i.baseHalf / capRadius;
  const half = (x: number) => {
    if (x <= left || x >= right) return 0;
    const u = clamp((x - left) / length, 0, 1);
    const body = (i.baseHalf + i.spread * 0.5) * (1 + (i.thin - 1) * Math.sin(Math.PI * u));
    // Scale the closed capsule instead of adding height inside a fixed-radius
    // cap, which otherwise leaves a step at its vertical tip while pressed.
    const base = baseHalf(x);
    const target = base * body / Math.max(0.001, i.baseHalf) + i.bulge * gaussian(x - i.bulgeX, i.sigma) * gate(x);
    return Math.max(0, base + (target - base) * liftScale);
  };
  const center = (x: number) => i.cy + i.pluck * liftScale * Math.sin(Math.PI * clamp((x - left) / length, 0, 1))
    * gaussian(x - i.pluckX, Math.max(12, length * 0.35));
  return {
    left, right, gate, half, maxLift, liftLimit: widthLimit,
    pressureStep: Math.max(4, i.baseHalf * 0.75),
    cy: i.cy,
    top: (x: number) => center(x) - half(x),
    bottom: (x: number) => center(x) + half(x),
    restTop: (x: number) => i.cy - baseHalf(x),
    restBottom: (x: number) => i.cy + baseHalf(x),
    changing: Math.abs(i.spread) + Math.abs(i.thin - 1) + Math.abs(i.bulge) + Math.abs(i.pluck) > 0.001,
  };
}

export type TimelinePressure = {
  id: string; originY: number; reach: number; profile: ReturnType<typeof timelineBarProfile>;
};

/** Apply neighbour pressure without inverting a narrow bar or spending the
 * outward lift budget twice when its own animation is still recovering. */
export function timelineBarEdge(shape: ReturnType<typeof timelineBarProfile>, x: number, side: -1 | 1, pressure: number) {
  const y = side < 0 ? shape.top(x) : shape.bottom(x);
  const maxYield = shape.half(x) * 0.7;
  const offset = clamp(pressure, -maxYield, maxYield) * shape.gate(x);
  if (side * offset <= 0) return y + offset;
  const rest = side < 0 ? shape.restTop(x) : shape.restBottom(x);
  const remaining = Math.max(0, shape.liftLimit - side * (y - rest));
  return y + side * limitTimelineLift(side * offset, remaining);
}

// A compact Gaussian approximation. The shoulder extends past the physical
// cap, so a neighbour turns gradually instead of stopping at that cap's x.
const TIMELINE_PRESSURE_KERNEL = [1, 8, 28, 56, 70, 56, 28, 8, 1];

/** Local, compact vertical falloff: the next near edge yields, its far edge does not. */
export function timelineYield(x: number, y: number, sources: TimelinePressure[], strength: number, exclude?: string) {
  let displacement = 0, maxLift = 0;
  for (const source of sources) {
    if (source.id === exclude) continue;
    const shape = source.profile;
    maxLift = Math.max(maxLift, shape.maxLift);
    const shoulder = shape.pressureStep * 4;
    if (x <= shape.left - shoulder || x >= shape.right + shoulder) continue;
    const direction = Math.sign(y - source.originY - shape.cy);
    let softened = 0;
    for (let tap = 0; tap < TIMELINE_PRESSURE_KERNEL.length; tap++) {
      const sx = x + (tap - 4) * shape.pressureStep;
      if (sx <= shape.left || sx >= shape.right) continue;
      const edge = direction < 0 ? shape.top(sx) : shape.bottom(sx);
      const rest = direction < 0 ? shape.restTop(sx) : shape.restBottom(sx);
      const outward = Math.max(0, direction * (edge - rest));
      const positive = clamp(outward / 0.25, 0, 1);
      const expansion = outward * positive ** 3 * (positive * (6 * positive - 15) + 10) * shape.gate(sx);
      // Keep vertical decay tied to each sample's live edge. Horizontal
      // softening cannot spread pressure onto a neighbour's far side.
      const distance = Math.max(0, direction * (y - source.originY - edge));
      const u = clamp(distance / Math.max(1, source.reach), 0, 1);
      const falloff = 1 - u * u * u * (u * (6 * u - 15) + 10);
      softened += TIMELINE_PRESSURE_KERNEL[tap] * expansion * falloff;
    }
    displacement += direction * softened * strength / 256;
  }
  // Also bound amplified avoidance and overlapping sources during transitions.
  return limitTimelineLift(displacement, maxLift);
}

/** Concentric resting corners: frame radius = bar radius + the shell gap. */
export function timelineFrame(width: number, height: number, rowHeight: number, barInset: number, edgePadding: number,
  sources: TimelinePressure[], strength: number) {
  if (width <= 1 || height <= 1) return { d: "", radius: 0 };
  const half = (height - 1) / 2;
  const barHalf = Math.max(3, rowHeight / 2 - barInset);
  const radius = Math.max(0.5, Math.min(barHalf + Math.min(barInset, edgePadding) - 0.5, half, (width - 1) / 2));
  const cy = height / 2;
  const shape = (x: number) => {
    const dx = Math.min(x - 0.5, width - 0.5 - x);
    return dx >= radius ? half : half - radius + Math.sqrt(Math.max(0, radius ** 2 - (radius - dx) ** 2));
  };
  const edge = (x: number, side: -1 | 1) => {
    const y = cy + side * shape(x);
    const u = clamp(Math.min(x - 0.5, width - 0.5 - x) / radius, 0, 1);
    const gate = u * u * (3 - 2 * u);
    return y + timelineYield(x, y, sources, strength) * gate;
  };
  return { d: edgeProfilePath(samples(0.5, width - 0.5, radius + 1, 1), x => edge(x, -1), x => edge(x, 1)), radius };
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
    return u * u * u * (u * (6 * u - 15) + 10); // smootherstep: C2, no curvature jump
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
    return u * u * u * (u * (6 * u - 15) + 10); // smootherstep: C2, no curvature jump
  };
  const shoulderBlend = (x: number, rail: number, head: number) =>
    2.5 * focus * smoothGate((Math.abs(x - cx) - flatHalf) / 8)
      * smoothGate(rail / 2.5) * smoothGate(head / 2.5);
  const leftBody = body(left);
  const rightBody = body(right);
  const outerEnvelope = (x: number) => {
    const rail = body(x) * cap(x, left, right, leftBody, rightBody);
    // The shell wraps the round head even near the ends or with a narrow
    // shoulder. Blend the contact instead of flattening/clipping the circle.
    const head = capsule(x, headHalf + shellGap);
    return smoothMax(rail, head, shoulderBlend(x, rail, head));
  };
  const outerHalf = outerEnvelope;
  const fillLeft = left + shellGap;
  const fillRight = Math.min(right - shellGap, cx + headRX);
  const fillLeftRadius = Math.max(1, body(fillLeft) - shellGap);
  const innerHalf = (x: number) => {
    const head = capsule(x, headHalf);
    const rail = (body(x) - shellGap) * cap(x, fillLeft, fillRight, fillLeftRadius, headRX);
    const envelope = x >= cx
      ? head
      : smoothMax(head, rail, shoulderBlend(x, rail, head));
    return Math.max(0, Math.min(envelope, outerEnvelope(x) - shellGap));
  };
  const outerPath = profilePath(samples(left, right, Math.max(outerRest, headRX + gap) + 1, 0.8, 0.2), outerHalf, () => 14);
  // Use SVG arcs for the exposed head, so the tip stays round at any zoom.
  const fillXs = samples(fillLeft, cx, headRX + 1, 0.8, 0.2);
  const fillHeights = fillXs.map(innerHalf);
  const fillTop = fillXs.map((x, n) => `${n === 0 ? "M" : "L"}${f(x)} ${f(14 - fillHeights[n])}`).join("");
  const fillBottom = fillXs.map((_, index) => {
    const reverse = fillXs.length - 1 - index;
    return `L${f(fillXs[reverse])} ${f(14 + fillHeights[reverse])}`;
  }).join("");
  const capCx = cx + flatHalf;
  // The opaque head remains behind the thumb even at min. Progress changes
  // the selected length, never its color or opacity.
  const fillPath = `${fillTop}L${f(capCx)} ${f(14 - headHalf)}A${f(headHalf)} ${f(headHalf)} 0 0 1 ${f(fillRight)} 14A${f(headHalf)} ${f(headHalf)} 0 0 1 ${f(capCx)} ${f(14 + headHalf)}${fillBottom}Z`;
  return { outerPath, fillPath, cx, thumbW, thumbH, left, right, fillLeft, fillRight, outerHalf, innerHalf };
}

/**
 * Shell + core (外壳包裹内芯), the Slider's nested look generalised to any
 * rounded rectangle (Button). Conformal by construction: the core is a rounded
 * rectangle `inset` px inside the button (radius r − inset, concentric), and
 * the shell is the core offset outward by exactly `inset` along its normals.
 * The gap is therefore the same all round, at the ends and over the swell.
 * Around `bulgeX` the core swells by up to `bulge` px (gaussian), and the shell
 * rises with it — like the Slider, where both surfaces bulge together.
 */
export type ShellCoreInput = {
  width: number;
  height: number;
  radius: number;
  inset: number;
  bulge: number;
  bulgeX: number;
  sigma: number;
};

type Pt = [number, number];

function closedPath(pts: Pt[]) {
  if (pts.length < 3) return "";
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("") + "Z";
}

/** Offset a closed, clockwise (y-down) polygon outward by `d` along vertex normals. */
function offsetPolygon(pts: Pt[], d: number): Pt[] {
  if (d === 0) return pts;
  const n = pts.length;
  return pts.map(([x, y], i) => {
    const [ax, ay] = pts[(i - 1 + n) % n];
    const [bx, by] = pts[(i + 1) % n];
    const tx = bx - ax;
    const ty = by - ay;
    const len = Math.hypot(tx, ty) || 1;
    return [x + (ty / len) * d, y - (tx / len) * d];
  });
}

export function shellCore(i: ShellCoreInput) {
  const W = Math.max(1, i.width);
  const H2 = Math.max(0.5, i.height / 2);
  const r = clamp(i.radius, 0, H2);
  const inset = clamp(i.inset, 0, H2 - 0.5);
  const sigma = Math.max(1, i.sigma);
  const swell = (x: number) => i.bulge * gaussian(x - i.bulgeX, sigma);
  // Ends swell horizontally as well when the pointer is near them.
  const cx0 = inset - swell(inset);
  const cx1 = W - inset + swell(W - inset);
  const coreR = Math.max(0.5, r - inset);
  // Round the ends with the corner radius applied to the *swollen* body so the
  // end stays concentric with the shell instead of flattening.
  const coreHalf = (x: number) => {
    const body = H2 - inset + swell(x);
    return capHalf(x, cx0, cx1, body, Math.min(body, coreR + Math.max(0, swell(x))));
  };
  const xs = samples(cx0, cx1, coreR + 2, 1, 0.2);
  const top: Pt[] = xs.map((x) => [x, H2 - coreHalf(x)]);
  const bottom: Pt[] = [...xs].reverse().map((x) => [x, H2 + coreHalf(x)]);
  const raw = [...top, ...bottom];
  const core: Pt[] = raw.filter(([x, y], k) => {
    const [px, py] = raw[(k - 1 + raw.length) % raw.length];
    return Math.abs(x - px) > 1e-6 || Math.abs(y - py) > 1e-6;
  });
  const shell = offsetPolygon(core, inset);
  return { shellPath: closedPath(shell), corePath: closedPath(core), core, shell, coreHalf, cx0, cx1 };
}

/**
 * Annular sector ("tile") for RadialPicker, as a closed polygon.
 * The two straight sides are parallel to the sector's dividers at a constant
 * perpendicular distance `side` — not a constant angle — so the gap between
 * neighbouring tiles is the same from hub to rim, for any number of sectors.
 * `rOut` may vary with angle (the rim swell).
 */
export function annularSector(i: { cx: number; cy: number; mid: number; half: number; rIn: number; rOut: (a: number) => number; side: number; steps?: number }) {
  const steps = i.steps ?? 24;
  const lo = i.mid - i.half;
  const hi = i.mid + i.half;
  // angle at which a circle of radius r sits `side` away from a divider ray
  const off = (r: number) => Math.asin(Math.min(1, i.side / Math.max(i.side, r)));
  // the outer radius depends on the angle and vice versa: two fixed-point passes
  const solve = (edge: number, dir: 1 | -1) => {
    let a = edge + dir * off(i.rOut(edge));
    a = edge + dir * off(i.rOut(a));
    return edge + dir * off(i.rOut(a));
  };
  const o0 = solve(lo, 1);
  const o1 = solve(hi, -1);
  const i0 = lo + off(i.rIn);
  const i1 = hi - off(i.rIn);
  const pts: [number, number][] = [];
  if (o1 <= o0 || i1 <= i0) return pts;
  for (let j = 0; j <= steps; j++) {
    const a = o0 + ((o1 - o0) * j) / steps;
    const r = i.rOut(a);
    pts.push([i.cx + Math.cos(a) * r, i.cy + Math.sin(a) * r]);
  }
  for (let j = steps; j >= 0; j--) {
    const a = i0 + ((i1 - i0) * j) / steps;
    pts.push([i.cx + Math.cos(a) * i.rIn, i.cy + Math.sin(a) * i.rIn]);
  }
  return pts;
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
