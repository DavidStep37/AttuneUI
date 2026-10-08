/**
 * Liquid Glass lensing for the "liquid" proposal.
 *
 * Each matching element gets `backdrop-filter: url(#lens) blur() saturate()`.
 * The SVG filter displaces the backdrop with a map generated for the element's
 * exact size and corner radius: pixels inside a bezel near the edge sample
 * content further inward, so the background bends at the rim like thick glass.
 *
 * Only Chromium supports SVG filters in backdrop-filter. Other browsers, and
 * users who prefer reduced transparency, keep the CSS frosted-glass fallback.
 */

export type LensOptions = {
  /** width of the refracting rim in px */
  bezel: number;
  /** displacement strength in px */
  scale: number;
  blur: number;
  saturate: number;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const filters = new Map<string, string>();
let root: SVGSVGElement | null = null;
let seq = 0;

export function lensSupported() {
  if (typeof window === "undefined") return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  const chromium = !!brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  return chromium && CSS.supports("backdrop-filter", "blur(1px)") && !matchMedia("(prefers-reduced-transparency: reduce)").matches;
}

function ensureRoot() {
  if (root?.isConnected) return root;
  root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("width", "0");
  root.setAttribute("height", "0");
  root.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  root.dataset.liquidLens = "";
  document.body.appendChild(root);
  return root;
}

/** Displacement map: R/G encode the x/y sampling offset (128 = none). */
function mapURL(w: number, h: number, r: number, bezel: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const hx = w / 2;
  const hy = h / 2;
  const rr = Math.min(r, hx, hy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hx;
      const py = y + 0.5 - hy;
      // Rounded-rect signed distance and outward normal.
      const qx = Math.abs(px) - (hx - rr);
      const qy = Math.abs(py) - (hy - rr);
      let nx: number, ny: number, sdf: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        nx = qx / len;
        ny = qy / len;
        sdf = len - rr;
      } else if (qx > qy) {
        nx = 1; ny = 0; sdf = qx - rr;
      } else {
        nx = 0; ny = 1; sdf = qy - rr;
      }
      nx *= Math.sign(px) || 1;
      ny *= Math.sign(py) || 1;
      const inside = -sdf;
      const i = (y * w + x) * 4;
      let dx = 0;
      let dy = 0;
      if (inside >= 0 && inside < bezel) {
        // Convex rim: strongest at the edge, easing to zero inside the bezel.
        const t = 1 - inside / bezel;
        const m = t * t * (3 - 2 * t);
        dx = -nx * m;
        dy = -ny * m;
      }
      img.data[i] = Math.round(128 + dx * 127);
      img.data[i + 1] = Math.round(128 + dy * 127);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function filterFor(w: number, h: number, r: number, o: LensOptions) {
  const key = `${w}x${h}r${r}b${o.bezel}s${o.scale}`;
  const cached = filters.get(key);
  if (cached && document.getElementById(cached)) return cached;
  const id = `at-liquid-lens-${++seq}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = id;
  for (const [k, v] of Object.entries({ x: "0", y: "0", width: String(w), height: String(h), filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" })) filter.setAttribute(k, v);
  const image = document.createElementNS(SVG_NS, "feImage");
  for (const [k, v] of Object.entries({ x: "0", y: "0", width: String(w), height: String(h), preserveAspectRatio: "none", result: "map", href: mapURL(w, h, r, o.bezel) })) image.setAttribute(k, v);
  const displace = document.createElementNS(SVG_NS, "feDisplacementMap");
  for (const [k, v] of Object.entries({ in: "SourceGraphic", in2: "map", scale: String(o.scale), xChannelSelector: "R", yChannelSelector: "G" })) displace.setAttribute(k, v);
  filter.append(image, displace);
  ensureRoot().appendChild(filter);
  filters.set(key, id);
  return id;
}

function apply(el: HTMLElement, o: LensOptions) {
  const w = Math.round(el.offsetWidth);
  const h = Math.round(el.offsetHeight);
  if (w < 8 || h < 8) return;
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const id = filterFor(w, h, Math.round(Math.min(radius, w / 2, h / 2)), o);
  el.style.backdropFilter = `url(#${id}) blur(${o.blur}px) saturate(${o.saturate}%)`;
  el.dataset.liquidLensed = "";
}

/** Watch `scope` for elements matching each selector and keep their lens in sync with size. */
export function attachLiquidLens(scope: HTMLElement, targets: { selector: string; options: LensOptions }[]) {
  if (!lensSupported()) return () => {};
  const tracked = new Map<HTMLElement, LensOptions>();
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      const o = tracked.get(el);
      if (o) apply(el, o);
    }
  });
  const scan = () => {
    for (const { selector, options } of targets) {
      scope.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (tracked.has(el)) return;
        tracked.set(el, options);
        ro.observe(el);
        apply(el, options);
      });
    }
    for (const el of tracked.keys()) if (!el.isConnected) { ro.unobserve(el); tracked.delete(el); }
  };
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(scope, { childList: true, subtree: true });
  return () => {
    mo.disconnect();
    ro.disconnect();
    for (const el of tracked.keys()) { el.style.backdropFilter = ""; delete el.dataset.liquidLensed; }
    tracked.clear();
    root?.remove();
    root = null;
    filters.clear();
  };
}

/** Specular light follows the pointer: sets --lg-x / --lg-y (%) on the hovered glass surface. */
export function attachSpecular(scope: HTMLElement, selector: string) {
  let frame = 0;
  let last: PointerEvent | null = null;
  const update = () => {
    frame = 0;
    const e = last;
    if (!e) return;
    const el = (e.target as Element | null)?.closest?.(selector) as HTMLElement | null;
    if (!el || !scope.contains(el)) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lg-x", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--lg-y", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };
  const onMove = (e: PointerEvent) => {
    last = e;
    if (!frame) frame = requestAnimationFrame(update);
  };
  scope.addEventListener("pointermove", onMove, { passive: true });
  scope.addEventListener("pointerdown", onMove, { passive: true });
  return () => {
    scope.removeEventListener("pointermove", onMove);
    scope.removeEventListener("pointerdown", onMove);
    cancelAnimationFrame(frame);
  };
}
