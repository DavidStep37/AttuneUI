type Curve = readonly number[];

/** Offset the sampled curve by a circular clearance in screen pixels. The
 * envelope of segment capsules handles vertical tangents and overshoot without
 * offset-curve loops. gap is measured from the visible 2px stroke's edge. */
export function bezierSideEdges(curve: Curve, size: number, gap = 2.5) {
  const radius = gap + 1;
  const count = Math.max(2, Math.ceil(size / 0.75));
  const upper = Array<number>(count + 1).fill(Infinity);
  const lower = Array<number>(count + 1).fill(-Infinity);
  const points: { x: number; y: number }[] = [];
  for (let j = 0; j <= 512; j++) {
    const t = j / 512, u = 1 - t;
    points.push({ x: size * (3 * u * u * t * curve[0] + 3 * u * t * t * curve[2] + t ** 3),
      y: size * (1 - (3 * u * u * t * curve[1] + 3 * u * t * t * curve[3] + t ** 3)) });
  }
  // Continue the endpoint tangents outside the square: a linear curve produces
  // two straight parallel hypotenuses, including near the square's corners.
  const extend = (p: typeof points[number], q: typeof p) => {
    const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
    return { x: p.x + dx / d * radius * 3, y: p.y + dy / d * radius * 3 };
  };
  points.unshift(extend(points[0], points[1]));
  points.push(extend(points.at(-1)!, points.at(-2)!));
  for (const point of points) {
    const start = Math.max(0, Math.ceil((point.x - radius) / size * count));
    const end = Math.min(count, Math.floor((point.x + radius) / size * count));
    for (let index = start; index <= end; index++) {
      const distance = index / count * size - point.x;
      if (Math.abs(distance) > radius) continue;
      const height = Math.sqrt(Math.max(0, radius * radius - distance * distance));
      upper[index] = Math.min(upper[index], point.y - height);
      lower[index] = Math.max(lower[index], point.y + height);
    }
  }
  for (let j = 1; j < points.length; j++) {
    const a = points[j - 1], b = points[j], dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-10) continue;
    const nx = -dy / length * radius, ny = dx / length * radius;
    const start = Math.max(0, Math.ceil((Math.min(a.x, b.x) - radius) / size * count));
    const end = Math.min(count, Math.floor((Math.max(a.x, b.x) + radius) / size * count));
    for (let k = start; k <= end; k++) {
      const x = k / count * size;
      if (Math.abs(dx) > 1e-10) for (let sign = -1; sign <= 1; sign += 2) {
        const t = (x - a.x - sign * nx) / dx;
        if (t >= 0 && t <= 1) {
          const height = a.y + sign * ny + t * dy;
          upper[k] = Math.min(upper[k], height);
          lower[k] = Math.max(lower[k], height);
        }
      }
    }
  }
  return { upper, lower };
}

export function bezierSidePath(edge: number[], size: number, upper: boolean) {
  const boundary = upper ? 0 : size;
  return `M0 ${boundary}L${size} ${boundary}` + edge.slice().reverse().map((y, i) =>
    `L${((edge.length - 1 - i) / (edge.length - 1) * size).toFixed(3)} ${Math.max(0, Math.min(size, y)).toFixed(3)}`).join('') + 'Z';
}
