// Node 22: node --experimental-strip-types scripts/test-slider-geometry.mjs
import assert from "node:assert/strict";
import { nestedSlider, snapSliderValue } from "../src/core/geometry.ts";

assert.equal(snapSliderValue(7, 5, 20, 2), 7, "Step is anchored to min");
assert.equal(snapSliderValue(0.3, 0.1, 1, 0.2), 0.3, "Decimal offsets do not leak floating-point noise");
assert.equal(snapSliderValue(1, 0, 1, 0.3), 1, "Maximum is reachable even when the range is not a multiple of step");

const base = { width: 280, progress: 0.5, focus: 0, deform: 1, velocity: 0, gap: 2, bulgeHeight: 10, bulgeWidth: 3, thumbHoverScale: 2.4, endInset: 2.4, neckDepth: 1, trail: 0.2, stretchL: 0, stretchR: 0 };
const rest = nestedSlider(base);
const hover = nestedSlider({ ...base, focus: 1 });
assert.equal(rest.thumbW, 4, "Resting dot is 4px");
assert(Math.abs(hover.thumbW - 14.4) < 1e-6, "Expanded dot retains its established size");
const right = nestedSlider({ ...base, focus: 1, velocity: 800 });
const left = nestedSlider({ ...base, focus: 1, velocity: -800 });
const sample = rest.cx * 0.35;
assert(hover.outerHalf(hover.cx) > rest.outerHalf(rest.cx) + 4, "Hover lifts the outer surface");
assert(hover.innerHalf(hover.cx) > rest.innerHalf(rest.cx) + 4, "Hover lifts the selected surface");
assert(hover.innerHalf(sample) < rest.innerHalf(sample), "Hover narrows the body by a fixed amount");
assert(rest.outerHalf(sample) - hover.outerHalf(sample) > 2, "The taller outer rail still visibly narrows on hover");
assert(rest.innerHalf(sample) - hover.innerHalf(sample) > 2, "The selected fill visibly narrows with the outer rail");
assert(Math.abs(right.innerHalf(sample) - left.innerHalf(sample)) < 0.001, "Direction cannot thicken or thin the body");
assert.equal(right.cx, left.cx, "Direction changes the shape, never the value position");
assert(Math.abs(hover.outerHalf(20) - hover.outerHalf(260)) < 1e-6, "Both ends narrow equally");
assert(hover.outerHalf(70) < hover.outerHalf(20) - 0.4, "A shallow neck dips inward before rising to the endpoint");
assert(hover.outerHalf(260) < rest.outerHalf(260) - 1, "Hover also thins the right endpoint");
assert(hover.outerHalf(hover.cx + 35) < rest.outerHalf(rest.cx + 35), "Compact shoulder returns below resting thickness within 35px");
for (const fraction of [0, 0.25, 0.5, 0.75, 0.95]) {
  const radius = hover.fillRight - hover.cx;
  assert(Math.abs(hover.innerHalf(hover.cx + radius * fraction) - radius * Math.sqrt(1 - fraction ** 2)) < 1e-6, "The exposed head is circular, not a twice-tapered shoulder");
}
assert(hover.fillPath.includes("A"), "Round head uses exact SVG arcs");
for (const progress of [0.3, 0.5, 0.8]) {
  const s = nestedSlider({ ...base, width: 640, progress, focus: 1 });
  // Sample halfway between the handle and left end, outside the bulge.
  assert(Math.abs(s.outerHalf(s.cx / 2) - (12 - base.endInset - base.neckDepth)) < 0.001, "Selected length does not change neck thickness");
}
for (const progress of [0, 0.000001, 0.001, 0.01]) {
  const s = nestedSlider({ ...base, progress });
  assert(s.fillPath.length > 0, 'Minimum and tiny values retain the dark thumb head');
  assert(s.innerHalf(s.cx) > s.thumbH / 2, 'The minimum head surrounds the white thumb');
}
const full = nestedSlider({ ...base, progress: 1, focus: 1 });
assert.equal(full.fillRight, full.right - base.gap, "Maximum fills to the nested right edge");
assert.equal(nestedSlider({ ...base, focus: 1, deform: 0, velocity: 900 }).outerPath, rest.outerPath, "Reduced deformation preserves static geometry");

for (const end of [0, 1]) {
  let previousHeight = Infinity;
  const endpoint = nestedSlider({ ...base, width: 640, focus: 1, progress: end });
  const middle = s => end === 1 ? s.cx / 2 : (s.cx + s.right) / 2;
  const initialHeight = endpoint.outerHalf(middle(endpoint));
  for (let pull = 0; pull <= 24; pull += 0.5) {
    const s = nestedSlider({ ...base, width: 640, focus: 1, progress: end, stretchL: end === 0 ? pull : 0, stretchR: end === 1 ? pull : 0 });
    const height = s.outerHalf(middle(s));
    assert(height <= previousHeight + 1e-6, "Both endpoints thin progressively as overscroll increases");
    assert(height >= initialHeight * 0.84, "Tension stays below 16% thinning");
    if (pull === 8) assert(height < initialHeight * 0.9, "Default overscroll gives a visible 10% contraction");
    if (pull > 0) assert(s.thumbW > s.thumbH, "Pulled thumb widens into a capsule");
    const horizontalGap = s.fillRight - s.cx - s.thumbW / 2;
    const verticalGap = s.innerHalf(s.cx) - s.thumbH / 2;
    assert(Math.abs(horizontalGap - verticalGap) < 1e-6, "Head conforms to the stretched thumb on both axes");
    const flatHalf = (s.thumbW - s.thumbH) / 2;
    assert(Math.abs(s.innerHalf(s.cx + flatHalf * 0.8) - s.innerHalf(s.cx)) < 1e-6, "The shell preserves the thumb's straight top and bottom sections");
    previousHeight = height;
  }
}

// Inspect tangent continuity on the shoulder, excluding the exposed cap tip.
for (const end of [0, 1]) {
  for (const pull of [0, 8, 16, 24]) {
    const s = nestedSlider({ ...base, focus: 1, progress: end, stretchL: end === 0 ? pull : 0, stretchR: end === 1 ? pull : 0 });
    for (const half of end === 1 ? [s.innerHalf, s.outerHalf] : [s.outerHalf]) {
      const step = 0.01;
      for (let distance = 1; distance < 45; distance += step) {
        const x = s.cx + (end === 1 ? -distance : distance);
        const before = Math.atan((half(x) - half(x - step)) / step);
        const after = Math.atan((half(x + step) - half(x)) / step);
        assert(Math.abs(after - before) < 0.005, 'Capsule and rail meet without a tangent jump at either endpoint');
      }
    }
  }
}

let cases = 0;
for (const width of [60, 140, 280, 640]) {
  for (const progress of [0, 0.001, 0.1, 0.5, 0.9, 0.999, 1]) {
    for (const focus of [0, 1, 1.1]) {
      for (const velocity of [-1200, 0, 1200]) {
        for (const deform of [0, 1, 2]) {
          const s = nestedSlider({ ...base, width, progress, focus, velocity, deform, stretchL: progress === 0 ? 8 * deform : 0, stretchR: progress === 1 ? 8 * deform : 0 });
          assert(!/NaN|Infinity/.test(s.outerPath + s.fillPath));
          assert(s.thumbW > 0 && s.thumbH > 0);
          for (let x = s.left; x <= s.right; x += 0.5) {
            assert(s.innerHalf(x) >= 0);
            assert(s.innerHalf(x) <= s.outerHalf(x) + 1e-8, "Inner surface must remain inside its container");
          }
          cases++;
        }
      }
    }
  }
}

// Overscroll must not create a kink where the rail meets the stretched head.
// Measure the largest turning angle between 0.25px segments on the shoulder;
// stretched shapes must stay as smooth as the resting hover shape.
{
  const tuned = { ...base, gap: 2.5, bulgeHeight: 8, bulgeWidth: 2, thumbHoverScale: 2.5, endInset: 3, neckDepth: 1.5, trail: 0.3, focus: 1 };
  const turn = (fn, a, b) => {
    const h = 0.25;
    let worst = 0;
    for (let x = a + h; x < b - h; x += h) {
      const s1 = (fn(x) - fn(x - h)) / h;
      const s2 = (fn(x + h) - fn(x)) / h;
      worst = Math.max(worst, Math.abs(Math.atan(s2) - Math.atan(s1)) * 180 / Math.PI);
    }
    return worst;
  };
  const shoulder = (s, side) => {
    const flat = (s.thumbW - s.thumbH) / 2;
    return side < 0 ? [s.cx - 40, s.cx - flat - 0.5] : [s.cx + flat + 0.5, s.cx + 40];
  };
  const restShape = nestedSlider({ ...tuned, progress: 0.5 });
  const limit = Math.max(turn(restShape.outerHalf, ...shoulder(restShape, -1)), turn(restShape.innerHalf, ...shoulder(restShape, -1))) * 1.3;
  for (const pull of [4, 8, 16]) {
    const atMax = nestedSlider({ ...tuned, progress: 1, stretchR: pull });
    const atMin = nestedSlider({ ...tuned, progress: 0, stretchL: pull });
    assert(turn(atMax.outerHalf, ...shoulder(atMax, -1)) <= limit, `Outer shoulder stays smooth when pulled ${pull}px past max`);
    assert(turn(atMax.innerHalf, ...shoulder(atMax, -1)) <= limit, `Fill shoulder stays smooth when pulled ${pull}px past max`);
    assert(turn(atMin.outerHalf, ...shoulder(atMin, 1)) <= limit, `Outer shoulder stays smooth when pulled ${pull}px past min`);
  }
}

// The head-to-rail seam must be curvature-continuous, not only tangent-continuous:
// a C1-only blend reads as a "hard" bend even without a visible corner.
{
  const tuned = { ...base, gap: 2.5, bulgeHeight: 8, bulgeWidth: 2, thumbHoverScale: 2.5, endInset: 3, neckDepth: 1.5, trail: 0.3, focus: 1 };
  const curvJump = (fn, a, b) => {
    const h = 0.1;
    let prev = null;
    let worst = 0;
    for (let x = a; x < b; x += h) {
      const y0 = fn(x - h), y1 = fn(x), y2 = fn(x + h);
      const d1 = (y2 - y0) / (2 * h);
      const k = (y2 - 2 * y1 + y0) / (h * h) / Math.pow(1 + d1 * d1, 1.5);
      if (prev !== null) worst = Math.max(worst, Math.abs(k - prev) / h);
      prev = k;
    }
    return worst;
  };
  for (const o of [{ progress: 0.5 }, { progress: 0.2 }, { progress: 1, stretchR: 8 }, { progress: 0, stretchL: 8 }]) {
    const s = nestedSlider({ ...tuned, ...o });
    const flat = (s.thumbW - s.thumbH) / 2;
    const [a, b] = o.progress === 0 ? [s.cx + flat + 1, s.cx + 30] : [s.cx - 30, s.cx - flat - 1];
    // At min the fill closes in its round tip right of the handle; stop short of it.
    const innerEnd = o.progress === 0 ? Math.min(b, s.fillRight - 2) : b;
    assert(curvJump(s.innerHalf, a, innerEnd) < 0.15, `Fill shoulder curvature is continuous (${JSON.stringify(o)})`);
    assert(curvJump(s.outerHalf, a, b) < 0.15, `Outer shoulder curvature is continuous (${JSON.stringify(o)})`);
  }
}
console.log(`PASS nested slider: equal ends, shallow neck, direction-independent thickness, round head, reduced motion, smooth overscroll shoulder, curvature-continuous seam, ${cases} containment/finite-geometry cases`);
