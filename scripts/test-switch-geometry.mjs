import assert from 'node:assert/strict';
import { softTrack } from '../src/core/geometry.ts';

const shape = (position, hover, speed, deform = 1, hoverScale = 1.22, bulge = 5) => {
  const cx = 8 + position * 12;
  const squash = Math.min(0.65, 0.5 * speed * deform);
  const scale = 1 + (hoverScale - 1) * hover * Math.min(1, deform);
  const w = 12 * scale * (1 + squash), h = 12 * scale / (1 + squash);
  const bump = bulge / 2 * Math.max(hover, speed) * deform;
  const track = softTrack({ left: 0, right: 28, cy: 12, baseHalf: 8,
    thumbX0: cx - w / 2, thumbX1: cx + w / 2, thumbHalfH: h / 2, thumbR: h / 2,
    bumpCx: cx, bumpHalf: bump, sigmaL: 8.4, sigmaR: 8.4, shrinkHalf: bump * 0.5, minClearance: 2 });
  return { ...track, cx, w, h };
};
let count = 0;
for (const pos of [-0.05, 0, 0.25, 0.5, 0.75, 1, 1.05])
  for (const hover of [0, 0.5, 1])
    for (const speed of [0, 0.5, 1])
      for (const deform of [0, 0.7, 1, 1.25, 2])
        for (const scale of [1, 1.22, 1.5])
          for (const bulge of [0, 5, 10]) {
            const s = shape(pos, hover, speed, deform, scale, bulge);
            const radius = s.h / 2 + s.clearance;
            const flatHalf = (s.w - s.h) / 2;
            for (let x = s.cx - flatHalf - radius; x <= s.cx + flatHalf + radius; x += 0.2) {
              const dx = Math.max(0, Math.abs(x - s.cx) - flatHalf);
              const shell = Math.sqrt(Math.max(0, radius * radius - dx * dx));
              assert(s.half(x) >= shell - 1e-5, 'The shell preserves clearance around the entire moving capsule');
            }
            assert(!/NaN|Infinity/.test(s.d));
            count++;
          }
for (const end of [0, 1]) {
  const s = shape(end, 1, 0), radius = s.h / 2 + s.clearance;
  const mirror = shape(1 - end, 1, 0);
  for (let fraction = 0; fraction < 1; fraction += 0.05) {
    const x = s.cx + (end === 0 ? -1 : 1) * radius * fraction;
    const expected = radius * Math.sqrt(1 - fraction * fraction);
    assert(Math.abs(s.half(x) - expected) < 0.1, 'The exposed hover arc is concentric with the thumb');
    assert(Math.abs(s.half(x) - mirror.half(28 - x)) < 1e-5, 'On and off ends wrap symmetrically');
  }
}
assert.equal(shape(0, 1, 1, 0).d, shape(0, 0, 0, 0).d, 'Reduced motion keeps the static silhouette');
console.log(`PASS Switch: ${count} capsule-containment cases, concentric hover ends, on/off symmetry, reduced motion`);
