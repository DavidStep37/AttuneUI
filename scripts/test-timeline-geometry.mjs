import assert from 'node:assert/strict';
import { timelineBarEdge, timelineBarProfile, timelineFrame, timelineYield } from '../src/core/geometry.ts';

let cases = 0;
for (const rowHeight of [20, 26, 32]) {
  for (const length of [24, 100, 400]) {
    for (const spread of [0.5, 2, 6]) {
      const half = rowHeight / 2 - 2.5;
      const profile = timelineBarProfile({ left: 70, right: 70 + length, minX: 2.5, maxX: 620,
        cy: rowHeight / 2, baseHalf: half, spread, thin: 1, bulge: 0, bulgeX: 90,
        sigma: half * 3, pluck: 0, pluckX: 90, maxLift: 4 });
      const source = { id: 'active', originY: rowHeight * 2, reach: half * 2 * 0.95, profile };
      for (const y of [rowHeight * 2 - 2.5, rowHeight * 3 - 0.5]) {
        const pressure = x => timelineYield(x, y, [source], 1);
        for (let x = profile.left - 1; x <= profile.right + 1; x += 0.1) {
          assert(Math.abs(pressure(x)) <= spread * 0.5 + 1e-8,
            `Horizontal cap spread cannot create a vertical spike: row=${rowHeight}, length=${length}, spread=${spread}, x=${x}, pressure=${pressure(x)}`);
        }
        // Check both current caps and the former cap positions. Subtracting
        // silhouettes at fixed x produced cusps at the old resting endpoints.
        for (const x of [profile.left, 70, profile.left + half, profile.right - half, 70 + length, profile.right]) {
          const h = 0.0001, mid = pressure(x);
          const before = (mid - pressure(x - h)) / h, after = (pressure(x + h) - mid) / h;
          assert(Math.abs(after - before) < 0.005, `Pressure joins with a continuous tangent at x=${x}`);
        }
        assert.equal(pressure(profile.left - profile.pressureStep * 4), 0);
        assert.equal(pressure(profile.right + profile.pressureStep * 4), 0);
        assert(Math.abs(pressure(profile.left - 1)) > 0.001, 'Soft shoulder extends past the left cap');
        assert(Math.abs(pressure(profile.right + 1)) > 0.001, 'Soft shoulder extends past the right cap');
        let peakSlope = 0;
        for (let x = profile.left - half * 3; x <= profile.left + half * 4; x += 0.25) {
          peakSlope = Math.max(peakSlope, Math.abs(pressure(x + 0.05) - pressure(x - 0.05)) / 0.1);
        }
        assert(peakSlope / (spread * 0.5) < 0.65 / half, 'Cap pressure rolls off over a broad shoulder, without a steep turn');
      }
      // The bar itself must reach its vertical tip continuously when enlarged.
      for (const x of [profile.left, profile.right]) {
        const interior = x === profile.left ? x + 1e-8 : x - 1e-8;
        assert(Math.abs(profile.half(interior) - profile.half(x)) < 0.001, 'Enlarged capsule has no endpoint step');
      }
      const frame = timelineFrame(640, rowHeight * 3, rowHeight, 2.5, 2.5, [source], 1);
      assert(!/NaN|Infinity/.test(frame.d));
      cases++;
    }
  }
}
console.log(`PASS ${cases} Timeline contours: no cap pressure spikes, broad soft shoulders, continuous tangents, closed enlarged tips, finite frame`);

let boundedCases = 0;
for (const rowHeight of [20, 26, 32]) {
  for (const length of [2, 8, 16, 24, 80, 400]) {
    for (const maxLift of [0, 1, 4, 8]) {
      for (const motion of [
        { spread: 0, thin: 1, bulge: 12, pluck: 0 },
        { spread: 12, thin: 1, bulge: 12, pluck: 0 },
        { spread: 0, thin: 1.6, bulge: 12, pluck: 0 },
        { spread: 3, thin: 1.6, bulge: 12, pluck: 20 },
        { spread: 3, thin: 1.6, bulge: 12, pluck: -20 },
      ]) {
        const half = rowHeight / 2 - 2.5, mid = 70 + length / 2;
        const profile = timelineBarProfile({ left: 70, right: 70 + length, minX: 2.5, maxX: 620,
          cy: rowHeight / 2, baseHalf: half, maxLift, ...motion, bulgeX: mid, sigma: 6, pluckX: mid });
        const source = { id: 'active', originY: rowHeight * 2, reach: half * 2 * 0.95, profile };
        let peak = 0;
        for (let n = 0; n <= 120; n++) {
          const x = profile.left + (profile.right - profile.left) * n / 120;
          const top = profile.top(x), bottom = profile.bottom(x);
          assert(Number.isFinite(top) && Number.isFinite(bottom) && top <= bottom, 'Limited contours stay finite and ordered');
          const lift = Math.max(profile.restTop(x) - top, bottom - profile.restBottom(x));
          peak = Math.max(peak, lift);
          assert(lift <= maxLift + 1e-8, `Combined hover/press/resize/pluck obeys the per-edge ceiling: ${lift} > ${maxLift}`);
          for (const pressure of [-12, 12]) {
            const renderedTop = timelineBarEdge(profile, x, -1, pressure);
            const renderedBottom = timelineBarEdge(profile, x, 1, pressure);
            assert(renderedTop <= renderedBottom, 'Neighbour avoidance cannot invert the rendered bar');
            assert(profile.restTop(x) - renderedTop <= maxLift + 1e-8 && renderedBottom - profile.restBottom(x) <= maxLift + 1e-8,
              'Own motion plus neighbour pressure share one final lift ceiling');
          }
          for (const y of [rowHeight * 2 - 2.5, rowHeight * 3 - 0.5]) {
            assert(Math.abs(timelineYield(x, y, [source], 1.5)) <= maxLift + 1e-8, 'Amplified neighbour/frame pressure also obeys the ceiling');
          }
        }
        if (length <= 8 && motion.spread === 0 && maxLift > 0) {
          assert(peak < maxLift * 0.6, 'Extremely narrow bars tighten the lift ceiling further');
        }
        for (const x of [profile.left, profile.right]) {
          assert(Math.abs(profile.top(x) - profile.bottom(x)) < 1e-8, 'Limited tips remain closed');
        }
        boundedCases++;
      }
    }
  }
}
const liftAt = bulge => {
  const profile = timelineBarProfile({ left: 30, right: 430, minX: 0, maxX: 500, cy: 13, baseHalf: 10.5,
    maxLift: 4, spread: 0, thin: 1, bulge, bulgeX: 230, sigma: 30, pluck: 0, pluckX: 230 });
  return profile.restTop(230) - profile.top(230);
};
const h = 0.001, knee = 3;
assert(Math.abs((liftAt(knee + h) - liftAt(knee)) / h - (liftAt(knee) - liftAt(knee - h)) / h) < 0.001,
  'Approaching the ceiling does not abruptly change the response');
assert(liftAt(12) > liftAt(6) && liftAt(12) < 4, 'Large amplitudes still respond smoothly below the ceiling');
console.log(`PASS ${boundedCases} Timeline lift limits: combined motion, amplified avoidance, narrow bars, zero ceiling, smooth saturation`);
