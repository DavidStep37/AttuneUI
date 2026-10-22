import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { useFeel } from "../core/feel";
import { bezierEasing, clamp, rubber } from "../core/geometry";
import { useAnimated } from "../core/hooks";
import type { ResolvedFeel } from "../core/schema";
import { Select } from "./Select";
import { MotionChevronDown } from "../core/icons";
import { BezierSides } from "./BezierSides";

export type Bezier = [number, number, number, number];

export const bezierPresets: { value: string; label: string; short: string; curve: Bezier }[] = [
  { value: "linear", label: "linear", short: "linear", curve: [0, 0, 1, 1] },
  { value: "ease", label: "ease", short: "ease", curve: [0.25, 0.1, 0.25, 1] },
  { value: "ease-in", label: "ease-in", short: "in", curve: [0.42, 0, 1, 1] },
  { value: "ease-out", label: "ease-out", short: "out", curve: [0, 0, 0.58, 1] },
  { value: "ease-in-out", label: "ease-in-out", short: "in-out", curve: [0.42, 0, 0.58, 1] },
  { value: "standard", label: "Attune standard", short: "standard", curve: [0.2, 0, 0, 1] },
  { value: "out-expo", label: "Attune out", short: "expo", curve: [0.16, 1, 0.3, 1] },
  { value: "back-out", label: "back-out", short: "back", curve: [0.34, 1.56, 0.64, 1] },
];

/** Small curve glyph for a cubic-bezier, drawn in a size×size box with overshoot room. */
export function CurveGlyph({ curve, size = 22, strokeWidth = 1.6 }: { curve: Bezier; size?: number; strokeWidth?: number }) {
  const p = 3;
  const s = size - p * 2;
  const x = (v: number) => p + v * s;
  const y = (v: number) => p + (1 - v) * s * 0.8 + s * 0.1;
  const [a, b, c, d] = curve;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <path d={`M${x(0)} ${y(0)} C${x(a)} ${y(b)} ${x(c)} ${y(d)} ${x(1)} ${y(1)}`} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

const same = (a: Bezier, b: Bezier) => a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
export type BezierPreset = { value: string; label: string; short: string; curve: Bezier };
export const presetOf = (c: Bezier, list: BezierPreset[] = bezierPresets) => list.find((p) => same(p.curve, c))?.value ?? "custom";
export const formatBezier = (c: Bezier) => c.map((v) => +v.toFixed(2)).join(", ");

const Y_TOP = 1.3;
const Y_BOTTOM = -0.3;
/** Room kept between an overshooting control point and the graph edge (in curve units). */
const FIT_MARGIN = 0.08;
/** Visible y-range that contains both control points; never smaller than the default range. */
const fitRange = (c: Bezier) => ({
  top: Math.max(Y_TOP, Math.max(c[1], c[3]) + FIT_MARGIN),
  bottom: Math.min(Y_BOTTOM, Math.min(c[1], c[3]) - FIT_MARGIN),
});

export type BezierEditorProps = {
  value: Bezier;
  onChange: (v: Bezier) => void;
  size?: number;
  showInputs?: boolean;
  showPresets?: boolean;
  /** the moving dot on the curve that previews the easing */
  showPreview?: boolean;
  /** Wrap graph, value field and preset picker in one sunken well; controls match the plot width. */
  framed?: boolean;
  /** Preset list; defaults to the built-in curves. Pass design-token easings here. */
  presets?: BezierPreset[];
  /** how presets are picked: the radial disc (fixed small set) or a dropdown (default) */
  presetPicker?: "radial" | "select";
  feel?: Partial<ResolvedFeel<"bezier">>;
};

/**
 * Bezier Editor — 控制点牵拉一根有弹性的线 (Handoff §5.5)
 */
export function BezierEditor({ value, onChange, size = 200, showInputs = true, showPresets = true, showPreview = true, framed = false, presets = bezierPresets, presetPicker = "select", feel: local }: BezierEditorProps) {
  const { p, t, deform, reduced } = useFeel("bezier", local);
  const plotClipId = useId();
  const pad = 10;
  const S = size;
  const H = S * (Y_TOP - Y_BOTTOM);
  const sx = (x: number) => pad + x * S;
  const sy = (y: number) => pad + (Y_TOP - y) * S;

  const v = [useAnimated(value[0]), useAnimated(value[1]), useAnimated(value[2]), useAnimated(value[3])];
  const drag1 = useAnimated(0);
  const drag2 = useAnimated(0);
  const hov1 = useAnimated(0);
  const hov2 = useAnimated(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<0 | 1 | 2>(0);
  const last = useRef<Bezier>(value);

  // Auto-fit: when a preset or typed value overshoots the default range (e.g. back-out, y = 1.56),
  // the plot zooms out about its centre inside the same box instead of drawing past the frame.
  // Strokes and radii are compensated, so only the geometry shrinks. Frozen while dragging.
  const zoom = useAnimated(1);
  const zoomY = useAnimated(0);
  const view = useRef(fitRange(value));
  const cx = pad + S / 2;
  const fitView = (c: Bezier, instant = false) => {
    const r = fitRange(c);
    view.current = r;
    const k = (Y_TOP - Y_BOTTOM) / (r.top - r.bottom);
    const ty = pad - k * (pad + (Y_TOP - r.top) * S);
    if (instant) { zoom.set(k); zoomY.set(ty); return; }
    zoom.to(k, t(p.presetSpring)); zoomY.to(ty, t(p.presetSpring));
  };
  const firstFit = useRef(true);
  useEffect(() => {
    if (dragging.current) return;
    fitView(value, firstFit.current);
    firstFit.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value[1], value[3], S]);
  const viewTransform = useTransform([zoom.mv, zoomY.mv] as const, ([k, ty]: number[]) => `translate(${cx * (1 - k)} ${ty}) scale(${k})`);
  // An SVG transform *attribute* (Motion would turn a `transform` prop into a CSS transform with fill-box origin).
  const viewG = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const apply = (tr: string) => viewG.current?.setAttribute("transform", tr);
    apply(viewTransform.get());
    return viewTransform.on("change", apply);
  }, [viewTransform]);
  /** Divide on-screen sizes (radii) by the zoom so handles keep their size. */
  const inv = useTransform(zoom.mv, (k) => 1 / Math.max(0.05, k));
  const endR = useTransform(inv, (i) => 2 * i);
  const hitR = useTransform(inv, (i) => 12 * i);

  // external change (preset / inputs) → visual morph, interruptible
  useEffect(() => {
    if (dragging.current) return;
    if (same(value, last.current) && same(value, v.map((a) => a.mv.get()) as Bezier)) return;
    last.current = value;
    value.forEach((val, i) => v[i].to(val, t(p.presetSpring)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value[0], value[1], value[2], value[3]]);

  const curve = useTransform([v[0].mv, v[1].mv, v[2].mv, v[3].mv] as const, ([a, b, c, d]: number[]) => {
    return `M${sx(0)} ${sy(0)} C${sx(a)} ${sy(b)} ${sx(c)} ${sy(d)} ${sx(1)} ${sy(1)}`;
  });
  const lineWidth = (ax: MotionValue<number>, ay: MotionValue<number>, dr: MotionValue<number>, ox: number, oy: number) =>
    useTransform([ax, ay, dr] as const, ([x, y, k]: number[]) => {
      const len = Math.hypot(x - ox, y - oy);
      return Math.max(0.4, 1.5 * (1 - p.lineThin * deform * 0.6 * k * Math.min(1, len / 0.9)));
    });
  const w1 = lineWidth(v[0].mv, v[1].mv, drag1.mv, 0, 0);
  const w2 = lineWidth(v[2].mv, v[3].mv, drag2.mv, 1, 1);
  const c1x = useTransform(v[0].mv, sx);
  const c1y = useTransform(v[1].mv, sy);
  const c2x = useTransform(v[2].mv, sx);
  const c2y = useTransform(v[3].mv, sy);
  const r1 = useTransform([hov1.mv, inv] as const, ([h, i]: number[]) => i * 5 * (1 + (p.pointHoverScale - 1) * h * Math.min(1, deform || 0.0001)));
  const r2 = useTransform([hov2.mv, inv] as const, ([h, i]: number[]) => i * 5 * (1 + (p.pointHoverScale - 1) * h * Math.min(1, deform || 0.0001)));

  const emit = (i: 1 | 2, x: number, y: number) => {
    const next = [...last.current] as Bezier;
    next[(i - 1) * 2] = +clamp(x, 0, 1).toFixed(2);
    next[(i - 1) * 2 + 1] = +clamp(y, -1, 2).toFixed(2);
    if (!same(next, last.current)) {
      last.current = next;
      onChange(next);
    }
  };

  const toLocal = (e: PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const k = zoom.mv.get();
    const ux = (e.clientX - r.left - cx * (1 - k)) / k;
    const uy = (e.clientY - r.top - zoomY.mv.get()) / k;
    return { x: (ux - pad) / S, y: Y_TOP - (uy - pad) / S };
  };

  const down = (i: 1 | 2) => (e: PointerEvent<SVGCircleElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    (e.currentTarget as SVGCircleElement).focus({ preventScroll: true });
    dragging.current = i;
    (i === 1 ? drag1 : drag2).set(1);
    v.forEach((a) => a.stop());
  };
  const move = (i: 1 | 2) => (e: PointerEvent<SVGCircleElement>) => {
    if (dragging.current !== i) return;
    const { x, y } = toLocal(e);
    const cx = clamp(x, 0, 1);
    const vx = cx + rubber(x - cx, p.edgeResistance, 0.06) * deform;
    const vy = clamp(y, view.current.bottom + 0.02, view.current.top - 0.02);
    v[(i - 1) * 2].set(vx);
    v[(i - 1) * 2 + 1].set(vy);
    emit(i, cx, vy);
  };
  const up = (i: 1 | 2) => () => {
    if (dragging.current !== i) return;
    dragging.current = 0;
    (i === 1 ? drag1 : drag2).to(0, t(p.recover));
    // settle the visual overshoot back to the real value
    v[(i - 1) * 2].to(last.current[(i - 1) * 2], t(p.recover));
    v[(i - 1) * 2 + 1].to(last.current[(i - 1) * 2 + 1], t(p.recover));
    fitView(last.current);
  };
  const key = (i: 1 | 2) => (e: KeyboardEvent) => {
    const k = e.shiftKey ? 0.1 : 0.01;
    const xi = (i - 1) * 2;
    let x = last.current[xi];
    let y = last.current[xi + 1];
    if (e.key === "ArrowLeft") x -= k;
    else if (e.key === "ArrowRight") x += k;
    else if (e.key === "ArrowUp") y += k;
    else if (e.key === "ArrowDown") y -= k;
    else return;
    e.preventDefault();
    emit(i, x, y);
    v[xi].to(last.current[xi], t(p.recover));
    v[xi + 1].to(last.current[xi + 1], t(p.recover));
  };
  const hoverOn = (h: typeof hov1, on: boolean) => h.to(on ? 1 : 0, t(p.recover, { exit: !on }));

  const grid = [0.25, 0.5, 0.75];
  // The curve's fixed endpoints sit on the bottom-left and top-right corners: keep those
  // square so the frame's corner is exactly the endpoint; round only the two free corners.
  const [L, T, Rt, B] = [sx(0), sy(1), sx(1), sy(0)];
  // Corner radius stays 8px on screen at any zoom.
  const plotPath = useTransform(inv, (i) => {
    const R = 8 * i;
    return `M${L} ${B} V${T + R} Q${L} ${T} ${L + R} ${T} H${Rt} V${B - R} Q${Rt} ${B} ${Rt - R} ${B} Z`;
  });

  return (
    <div className="at-bezier" data-at-interactive data-framed={framed || undefined} style={framed ? { ["--at-bezier-plot" as string]: `${S}px` } : undefined}>
      <div className="at-bezier-graph">
        <svg ref={svgRef} width={S + pad * 2} height={H + pad * 2} className="at-bezier-svg">
          <defs>
            <clipPath id={plotClipId}>
              <motion.path d={plotPath} />
            </clipPath>
          </defs>
          <g ref={viewG}>
          <motion.path className="at-bezier-plot" d={plotPath} />
          <g clipPath={`url(#${plotClipId})`}>
            <BezierSides values={v.map(a => a.mv)} dragging={dragging} size={S} x={sx(0)} y={sy(1)} reduced={reduced || !deform} spring={p.sideSpring} />
            {grid.map((g) => (
              <g key={g}>
                <line className="at-bezier-grid" x1={sx(g)} x2={sx(g)} y1={sy(0)} y2={sy(1)} />
                <line className="at-bezier-grid" x1={sx(0)} x2={sx(1)} y1={sy(g)} y2={sy(g)} />
              </g>
            ))}
            <line className="at-bezier-diag" x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} />
          </g>
          <motion.path className="at-bezier-border" d={plotPath} />
          <motion.line className="at-bezier-arm" x1={sx(0)} y1={sy(0)} x2={c1x} y2={c1y} style={{ strokeWidth: w1 }} />
          <motion.line className="at-bezier-arm" x1={sx(1)} y1={sy(1)} x2={c2x} y2={c2y} style={{ strokeWidth: w2 }} />
          <motion.path className="at-bezier-curve" d={curve} />
          {showPreview && <CurveDot value={value} sx={sx} sy={sy} r={endR} />}
          <motion.circle className="at-bezier-end" cx={sx(0)} cy={sy(0)} r={endR} />
          <motion.circle className="at-bezier-end" cx={sx(1)} cy={sy(1)} r={endR} />
          {([1, 2] as const).map((i) => (
            <g key={i}>
              <motion.circle
                className="at-bezier-hit"
                cx={i === 1 ? c1x : c2x}
                cy={i === 1 ? c1y : c2y}
                r={hitR}
                tabIndex={0}
                role="slider"
                aria-label={`控制点 ${i}：${last.current[(i - 1) * 2]}, ${last.current[(i - 1) * 2 + 1]}`}
                aria-valuenow={value[(i - 1) * 2]}
                onPointerDown={down(i)}
                onPointerMove={move(i)}
                onPointerUp={up(i)}
                onPointerCancel={up(i)}
                onLostPointerCapture={up(i)}
                onPointerEnter={() => hoverOn(i === 1 ? hov1 : hov2, true)}
                onPointerLeave={() => dragging.current !== i && hoverOn(i === 1 ? hov1 : hov2, false)}
                onFocus={() => hoverOn(i === 1 ? hov1 : hov2, true)}
                onBlur={() => hoverOn(i === 1 ? hov1 : hov2, false)}
                onKeyDown={key(i)}
              />
              <motion.circle className="at-bezier-point" cx={i === 1 ? c1x : c2x} cy={i === 1 ? c1y : c2y} r={i === 1 ? r1 : r2} />
            </g>
          ))}
          </g>
        </svg>
      </div>
      {(showInputs || showPresets) && (
        <div className="at-bezier-controls">
          {showInputs && <BezierInput value={value} onChange={onChange} />}
          {showPresets && (
            <Select
              aria-label="缓动预设"
              width="100%"
              placeholder="自定义"
              variant={presetPicker === "radial" ? "radial" : "dropdown"}
              value={presetOf(value, presets)}
              options={[
                ...presets.map((b) => ({ value: b.value, label: presetPicker === "radial" ? b.short : b.label, icon: <CurveGlyph curve={b.curve} /> })),
                ...(presetOf(value, presets) === "custom" && presetPicker !== "radial" ? [{ value: "custom", label: "自定义" }] : []),
              ]}
              renderHub={(o) => {
                const pr = presets.find((b) => b.value === o?.value);
                return pr ? <span className="at-radial-hub-preview"><CurveGlyph curve={pr.curve} size={34} strokeWidth={1.8} /><span>{pr.short}</span></span> : <span className="at-radial-hub-label">自定义</span>;
              }}
              onChange={(k) => {
                const pr = presets.find((b) => b.value === k);
                if (pr) onChange(pr.curve);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

const PERIOD = 1.9;
const MOVE = 1.1;

function useLoopProgress(value: Bezier) {
  const time = useMotionValue(0);
  const start = useRef<number | null>(null);
  useAnimationFrame((ts) => {
    if (start.current === null) start.current = ts;
    const s = ((ts - start.current) / 1000) % PERIOD;
    time.set(Math.min(1, s / MOVE));
  });
  const ease = bezierEasing(...value);
  const prog = useTransform(time, (u) => ease(u));
  return { time, prog };
}

function CurveDot({ value, sx, sy, r }: { value: Bezier; sx: (x: number) => number; sy: (y: number) => number; r: MotionValue<number> }) {
  const { time, prog } = useLoopProgress(value);
  const cx = useTransform(time, sx);
  const cy = useTransform(prog, sy);
  return <motion.circle className="at-bezier-dot" cx={cx} cy={cy} r={r} />;
}

/** Range the text field accepts; matches what dragging can produce. */
const LIMITS: [number, number][] = [[0, 1], [-1, 2], [0, 1], [-1, 2]];
const formatInput = (c: Bezier) => c.map((v) => +v.toFixed(3)).join(", ");

/** "x1, y1, x2, y2" → Bezier, clamped to LIMITS; null unless exactly four finite numbers. */
export function parseBezier(text: string): Bezier | null {
  const parts = text.replace(/^\s*cubic-bezier\(|\)\s*$/g, "").split(/[\s,，]+/).filter(Boolean).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts.map((n, i) => Math.round(clamp(n, LIMITS[i][0], LIMITS[i][1]) * 1000) / 1000) as Bezier;
}

/**
 * One text field for all four control values, comma separated. Commits on Enter / blur;
 * Esc or unparsable text restores the current curve (briefly marked invalid).
 */
function BezierInput({ value, onChange }: { value: Bezier; onChange: (v: Bezier) => void }) {
  const [draft, setDraft] = useState(() => formatInput(value));
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(formatInput(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value[0], value[1], value[2], value[3], editing]);
  useEffect(() => {
    if (!invalid) return;
    const id = setTimeout(() => setInvalid(false), 900);
    return () => clearTimeout(id);
  }, [invalid]);
  const commit = () => {
    const next = parseBezier(draft);
    if (!next) { setInvalid(true); setDraft(formatInput(value)); return; }
    setInvalid(false);
    if (!same(next, value)) onChange(next);
    setDraft(formatInput(next));
  };
  return (
    <input
      className="at-bezier-input"
      type="text"
      inputMode="decimal"
      spellCheck={false}
      autoComplete="off"
      aria-label="贝塞尔曲线数值 x1, y1, x2, y2"
      aria-invalid={invalid || undefined}
      placeholder="x1,y1,x2,y2"
      value={draft}
      onFocus={(e) => { setEditing(true); e.currentTarget.select(); }}
      onChange={(e) => { setDraft(e.target.value); setInvalid(false); }}
      onBlur={() => { commit(); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.preventDefault(); setDraft(formatInput(value)); e.currentTarget.blur(); }
      }}
    />
  );
}

/**
 * Collapsed row that expands the editor from its entry (展开保留来源).
 */
export function BezierField({
  label,
  value,
  onChange,
  size = 220,
  defaultOpen = false,
  feel,
}: {
  label: ReactNode;
  value: Bezier;
  onChange: (v: Bezier) => void;
  size?: number;
  defaultOpen?: boolean;
  feel?: Partial<ResolvedFeel<"bezier">>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { p, t } = useFeel("bezier", feel);
  const mini = 22;
  const [a, b, c, d] = value;
  const my = (y: number) => 2 + (1 - y) * (mini - 4) * 0.75 + (mini - 4) * 0.12;
  const mx = (x: number) => 2 + x * (mini - 4);
  return (
    <div className="at-bezier-field" data-open={open || undefined}>
      <button type="button" className="at-row at-bezier-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-at-interactive>
        <span className="at-row-label">{label}</span>
        <span className="at-row-control at-row-control-end">
          <svg width={mini} height={mini} className="at-bezier-mini" aria-hidden>
            <path d={`M${mx(0)} ${my(0)} C${mx(a)} ${my(b)} ${mx(c)} ${my(d)} ${mx(1)} ${my(1)}`} />
          </svg>
          <span className="at-bezier-text">{formatBezier(value)}</span>
          <MotionChevronDown size={12} strokeWidth={1.75} animate={{ rotate: open ? 180 : 0 }} transition={t(p.recover)} className="at-select-chevron" aria-hidden="true" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="at-reveal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { height: t(p.presetSpring), opacity: { duration: 0.16 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: t(p.presetSpring, { exit: true }), opacity: { duration: 0.1 } } }}
          >
            <motion.div
              className="at-reveal-inner at-bezier-field-body"
              style={{ transformOrigin: "100% 0%" }}
              initial={{ scale: 0.92 }}
              animate={{ scale: 1, transition: t(p.presetSpring) }}
              exit={{ scale: 0.92, transition: t(p.presetSpring, { exit: true }) }}
            >
              <BezierEditor value={value} onChange={onChange} size={size} feel={feel} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
