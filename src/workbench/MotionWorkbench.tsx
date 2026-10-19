import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { Copy, Grip, Maximize2, Minimize2, Play, RotateCcw } from "lucide-react";
import { AttuneRoot } from "../core/surface";
import { Button } from "../components/Button";
import { PanelGroup, Row, SliderField, NumberField } from "../components/Panel";
import { SwitchField } from "../components/Switch";
import { Select } from "../components/Select";
import { ScrollArea } from "../components/ScrollArea";
import { BezierEditor, type Bezier } from "../components/BezierEditor";
import { anchorPoint, anchors, clampPoint, nearestAnchor, serializeMotionConfig, type Anchor, type MotionConfig, type MotionDefinition, type MotionParam, type Point } from "./model";
import "./workbench.css";

type Mode = "minimized" | "floating";
/** Floating panel height: user-resizable from the bottom edge, remembered with its position. */
const PANEL = { width: 360, defaultHeight: 660, minHeight: 260 };
/** Toolbar: 28px buttons with an equal 12px optical inset on all four sides (grip dots sit ~2.7px inside their 16px box). */
const TOOLBAR = { height: 52, width: 10 + 16 + 8 + 28 * 3 + 8 * 2 + 12 };
type Placement = { anchor: Anchor; panel: Point | null; height: number | null };
const readPlacement = (key: string): Placement => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return { anchor: anchors.includes(value?.anchor) ? value.anchor : "bottom-center",
      panel: Number.isFinite(value?.panel?.x) && Number.isFinite(value?.panel?.y) ? value.panel : null,
      height: Number.isFinite(value?.height) ? Math.max(PANEL.minHeight, value.height) : null };
  } catch { return { anchor: "bottom-center", panel: null, height: null }; }
};

export type MotionWorkbenchProps = {
  definitions: MotionDefinition[];
  config: MotionConfig;
  onChange: (config: MotionConfig) => void;
  /** The previewed page. Rendered as-is: the workbench floats above it and never reflows the host. */
  children?: ReactNode;
  theme?: "light" | "dark" | "system";
};

/** Client-only preview workbench. Remount with key={projectId} when switching projects. */
export function MotionWorkbench({ definitions, config, onChange, children, theme = "system" }: MotionWorkbenchProps) {
  const storageKey = `attune-motion:placement:v1:${config.projectId}`;
  const [placement, setPlacement] = useState(() => readPlacement(storageKey));
  const [mode, setMode] = useState<Mode>("minimized");
  const [viewport, setViewport] = useState<Point>(() => ({ x: window.innerWidth, y: window.innerHeight }));
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  const drag = useRef<{ pointerId: number; start: Point; origin: Point; last: Point; mode: Mode } | null>(null);
  const stretch = useRef<{ pointerId: number; startY: number; origin: number; last: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reduced = !!useReducedMotion();
  const minimized = mode === "minimized";
  const width = minimized ? TOOLBAR.width : Math.min(PANEL.width, viewport.x - 24);
  const maxHeight = Math.max(PANEL.minHeight, viewport.y - 24);
  const height = minimized ? TOOLBAR.height : Math.min(maxHeight, dragHeight ?? placement.height ?? PANEL.defaultHeight);
  // While resizing, the top edge stays put (the stored point is not re-clamped against the growing height).
  const point = dragPoint ?? (minimized ? anchorPoint(placement.anchor, width, height, viewport)
    : dragHeight !== null ? clampPoint(placement.panel ?? { x: viewport.x - width - 16, y: 16 }, width, PANEL.minHeight, viewport)
    : clampPoint(placement.panel ?? { x: viewport.x - width - 16, y: 16 }, width, height, viewport));
  const transition = { type: "spring" as const, visualDuration: 0.38, bounce: 0.08 };

  useEffect(() => {
    const resize = () => setViewport({ x: window.innerWidth, y: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(placement)); } catch { /* Session memory still works. */ } }, [storageKey, placement]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 4000);
    return () => clearTimeout(timer);
  }, [status]);
  useEffect(() => {
    if (focusNext.current) { shell.current?.querySelector<HTMLButtonElement>(focusNext.current)?.focus(); focusNext.current = null; }
  }, [mode]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: globalThis.PointerEvent) => { if (!menuRoot.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menu]);

  const changeMode = (next: Mode) => {
    clearTimeout(hoverTimer.current); setMenu(false); setFallback(null); setDragPoint(null); setDragHeight(null);
    focusNext.current = next === "minimized" ? '[aria-label="展开调参面板"]' : '[aria-label="收起调参面板"]';
    setMode(next);
  };
  const update = (id: string, key: string, value: MotionParam) => onChange({ ...config, animations: {
    ...config.animations, [id]: { ...config.animations[id], [key]: value },
  } });
  const replay = async (id?: string) => {
    setMenu(false);
    const selected = definitions.filter(d => !id || d.id === id);
    const results = await Promise.allSettled(selected.map(d => Promise.resolve().then(() => d.replay(config.animations[d.id]))));
    const failed = results.flatMap((result, i) => result.status === "rejected" ? [selected[i].label] : []);
    if (failed.length) setStatus(`重播失败：${failed.join("、")}`);
  };
  const copy = async () => {
    const json = serializeMotionConfig(config, definitions);
    try { await navigator.clipboard.writeText(json); setFallback(null); setStatus("完整 JSON 已复制"); }
    catch { setFallback(json); setStatus("剪贴板不可用，请选中下方 JSON 手动复制"); }
  };
  const startDrag = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const rect = shell.current!.getBoundingClientRect();
    const origin = { x: rect.x, y: rect.y };
    drag.current = { pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin, last: origin, mode };
    e.currentTarget.setPointerCapture(e.pointerId);
    setMenu(false); setDragPoint(origin);
  };
  const moveDrag = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.last = clampPoint({ x: d.origin.x + e.clientX - d.start.x, y: d.origin.y + e.clientY - d.start.y }, width, height, viewport);
    setDragPoint(d.last);
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setPlacement(p => d.mode === "minimized" ? { ...p, anchor: nearestAnchor(d.last, width, height, viewport) } : { ...p, panel: d.last });
    setDragPoint(null);
  };
  /** Bottom-edge resize: height follows the pointer, bounded by the min height and the viewport bottom. */
  const heightFor = (y: number) => Math.round(Math.max(PANEL.minHeight, Math.min(viewport.y - 12 - point.y, y)));
  const startStretch = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    stretch.current = { pointerId: e.pointerId, startY: e.clientY, origin: height, last: height };
    setDragHeight(height);
  };
  const moveStretch = (e: PointerEvent<HTMLDivElement>) => {
    const s = stretch.current;
    if (!s || s.pointerId !== e.pointerId) return;
    s.last = heightFor(s.origin + e.clientY - s.startY);
    setDragHeight(s.last);
  };
  const endStretch = () => {
    const s = stretch.current;
    if (!s) return;
    stretch.current = null;
    setPlacement(p => ({ ...p, panel: p.panel ?? point, height: s.last }));
    setDragHeight(null);
  };
  const keyboardStretch = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const next = heightFor(height + (e.key === "ArrowDown" ? 1 : -1) * (e.shiftKey ? 80 : 20));
    setPlacement(p => ({ ...p, panel: p.panel ?? point, height: next }));
  };
  const keyboardMove = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!e.key.startsWith("Arrow")) return;
    e.preventDefault();
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (minimized) {
      const index = anchors.indexOf(placement.anchor);
      const col = Math.max(0, Math.min(2, index % 3 + dx));
      const row = Math.max(0, Math.min(1, Math.floor(index / 3) + dy));
      setPlacement(p => ({ ...p, anchor: anchors[row * 3 + col] }));
    } else {
      setPlacement(p => ({ ...p, panel: clampPoint({ x: point.x + dx * (e.shiftKey ? 40 : 10), y: point.y + dy * (e.shiftKey ? 40 : 10) }, width, height, viewport) }));
    }
  };
  const playButton = () => menuRoot.current?.querySelector<HTMLButtonElement>('[aria-label="重播全部动效"]');
  const menuKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.stopPropagation(); setMenu(false); playButton()?.focus(); }
    const items = Array.from(menuRoot.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) && items.length) {
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      items[e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length].focus();
    }
  };
  const grip = <button className="at-mw-grip" type="button" aria-label="拖动面板，方向键调整位置" title="拖动 · 方向键移动"
    onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={keyboardMove}><Grip size={16} /></button>;
  const copyButton = <Button size="md" iconOnly icon={<Copy size={15} />} aria-label="复制完整 JSON" title="复制完整 JSON" onClick={copy} />;

  return <>
    {children}
    {createPortal(<AttuneRoot theme={theme} material="frosted" blur={24} opacity={0.52} className="at-mw-root">
      <motion.div ref={shell} className="at-mw-shell at-panel" data-mode={mode} data-anchor={placement.anchor} data-resizing={dragHeight !== null || undefined}
        role="region" aria-label="Attune 动效调参" initial={false}
        animate={{ x: point.x, y: point.y, width, height, borderRadius: minimized ? 26 : 18 }}
        transition={reduced || dragPoint || dragHeight !== null ? { duration: 0 } : transition}
        onKeyDown={e => { if (e.key === "Escape" && !menu && !minimized) { e.stopPropagation(); changeMode("minimized"); } }}>
        {minimized ? <motion.div key="toolbar" className="at-mw-toolbar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.15 }}>
          {grip}
          <Button iconOnly icon={<Maximize2 size={15} />} aria-label="展开调参面板" title="展开调参面板" onClick={() => changeMode("floating")} />
          <div className="at-mw-play" ref={menuRoot} onKeyDown={menuKeys}
            onPointerEnter={() => clearTimeout(hoverTimer.current)}
            onPointerLeave={() => { hoverTimer.current = setTimeout(() => { if (!menuRoot.current?.contains(document.activeElement)) setMenu(false); }, 180); }}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setMenu(false); }}>
            {/* Hover (mouse) or ArrowUp/ArrowDown (keyboard) reveals per-animation replay; click replays all. */}
            <Button iconOnly icon={<Play size={15} />} disabled={!definitions.length} aria-label="重播全部动效" title="重播全部动效 · 悬停或方向键选择单个"
              aria-haspopup="menu" aria-expanded={menu}
              onPointerEnter={e => { if (e.pointerType === "mouse") setMenu(true); }} onClick={() => replay()}
              onKeyDown={e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setMenu(true); requestAnimationFrame(() => menuRoot.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()); } }} />
            {menu && <motion.div className="at-mw-menu" role="menu" aria-label="单项动效重播" data-below={point.y < viewport.y / 2 || undefined}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.14 }}>
              <span className="at-mw-menu-caption">独立重播</span>
              {definitions.map(d => <Button key={d.id} role="menuitem" onClick={() => { replay(d.id); playButton()?.focus(); }} icon={<Play size={12} />}>{d.label}</Button>)}
              {!definitions.length && <span>当前没有注册动效</span>}
            </motion.div>}
          </div>
          {copyButton}
        </motion.div> : <motion.div key="expanded" className="at-mw-expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.18 }}>
          <header className="at-mw-head">{grip}<div className="at-mw-heading"><strong>Attune <span>Motion</span></strong></div>
            <Button iconOnly icon={<Minimize2 size={15} />} aria-label="收起调参面板" title="收起调参面板" onClick={() => changeMode("minimized")} />
          </header>
          <ScrollArea className="at-mw-scroll-area" viewportClassName="at-mw-scroll">
            {!definitions.length && <p className="at-mw-note">还没有动效。注册动效后，参数会显示在这里。</p>}
            {definitions.map((d, index) => <PanelGroup key={d.id} title={d.label} badge={String(index + 1).padStart(2, "0")}
              actions={<Button size="sm" iconOnly icon={<Play size={12} />} aria-label={`重播${d.label}`} onClick={() => replay(d.id)} />}>
              {d.description && <p className="at-mw-note">{d.description}</p>}
              {d.fields.map(f => {
                const value = config.animations[d.id][f.key];
                const label = `${d.label} · ${f.label}`;
                if (f.type === "number") {
                  const Field = f.control === "number" ? NumberField : SliderField;
                  return <Field key={f.key} label={f.label} hint={f.hint} value={value as number} min={f.min} max={f.max} step={f.step} unit={f.unit}
                    onChange={v => update(d.id, f.key, v)} modified={value !== f.default} onReset={() => update(d.id, f.key, f.default)} />;
                }
                // SwitchField keeps the label left and the switch on the right edge, like slider readouts.
                if (f.type === "boolean") return <SwitchField key={f.key} label={f.label} hint={f.hint} checked={value as boolean} onChange={v => update(d.id, f.key, v)} />;
                if (f.type === "select") return <Row key={f.key} label={f.label} hint={f.hint}><Select aria-label={label} width="100%" value={value as string} options={f.options} onChange={v => update(d.id, f.key, v)} /></Row>;
                // Inline in the animation's own group (no second level): the field label names what it controls.
                const curve = value as Bezier;
                return <Row key={f.key} stacked label={f.label} hint={f.hint} modified={curve.some((n, i) => n !== f.default[i])} onReset={() => update(d.id, f.key, f.default)}>
                  <div className="at-mw-bezier"><BezierEditor size={180} presetPicker="radial" value={curve} onChange={v => update(d.id, f.key, v)} /></div></Row>;
              })}
            </PanelGroup>)}
          </ScrollArea>
          <footer className="at-mw-footer"><Button icon={<Play size={13} />} disabled={!definitions.length} onClick={() => replay()}>重播全部</Button>
            <Button iconOnly icon={<RotateCcw size={14} />} aria-label="恢复面板位置" title="恢复面板位置与高度" onClick={() => { setPlacement({ anchor: "bottom-center", panel: null, height: null }); setStatus("位置与高度已恢复"); }} />{copyButton}</footer>
          <div className="at-mw-resize" role="separator" aria-orientation="horizontal" aria-label="拖动调整面板高度，方向键调整" tabIndex={0}
            aria-valuemin={PANEL.minHeight} aria-valuemax={maxHeight} aria-valuenow={Math.round(height)}
            onPointerDown={startStretch} onPointerMove={moveStretch} onPointerUp={endStretch} onPointerCancel={endStretch} onLostPointerCapture={endStretch} onKeyDown={keyboardStretch}><span /></div>
        </motion.div>}
        <div className="at-mw-status" role="status" data-below={point.y < viewport.y / 2 || undefined}>{status}</div>
        {fallback && <div className="at-mw-copy-fallback" data-below={point.y < viewport.y / 2 || undefined}><textarea aria-label="完整动效 JSON，手动复制" readOnly value={fallback} onFocus={e => e.currentTarget.select()} autoFocus /><Button onClick={() => setFallback(null)}>关闭</Button></div>}
      </motion.div>
    </AttuneRoot>, document.body)}
  </>;
}
