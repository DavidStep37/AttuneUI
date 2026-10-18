import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { ChevronUp, Copy, Grip, Maximize2, Minimize2, PanelRight, Play, RotateCcw } from "lucide-react";
import { AttuneRoot } from "../core/surface";
import { Button } from "../components/Button";
import { PanelGroup, Row, SliderField, NumberField } from "../components/Panel";
import { Switch } from "../components/Switch";
import { Select } from "../components/Select";
import { BezierEditor, type Bezier } from "../components/BezierEditor";
import { anchorPoint, anchors, clampPoint, nearestAnchor, serializeMotionConfig, type Anchor, type MotionConfig, type MotionDefinition, type MotionParam, type Point } from "./model";
import "./workbench.css";

type Mode = "minimized" | "floating" | "sidebar";
type Placement = { anchor: Anchor; panel: Point | null };
const readPlacement = (key: string): Placement => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return { anchor: anchors.includes(value?.anchor) ? value.anchor : "bottom-center",
      panel: Number.isFinite(value?.panel?.x) && Number.isFinite(value?.panel?.y) ? value.panel : null };
  } catch { return { anchor: "bottom-center", panel: null }; }
};

export type MotionWorkbenchProps = {
  definitions: MotionDefinition[];
  config: MotionConfig;
  onChange: (config: MotionConfig) => void;
  /** Wrap the app's responsive layout root, including its header, so sidebar mode can push it. */
  children: ReactNode;
  theme?: "light" | "dark" | "system";
};

/** Client-only preview workbench. Remount with key={projectId} when switching projects. */
export function MotionWorkbench({ definitions, config, onChange, children, theme = "system" }: MotionWorkbenchProps) {
  const storageKey = `attune-motion:placement:v1:${config.projectId}`;
  const [placement, setPlacement] = useState(() => readPlacement(storageKey));
  const [mode, setMode] = useState<Mode>("minimized");
  const [viewport, setViewport] = useState<Point>(() => ({ x: window.innerWidth, y: window.innerHeight }));
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<string | null>(null);
  const drag = useRef<{ pointerId: number; start: Point; origin: Point; last: Point; mode: Mode } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reduced = !!useReducedMotion();
  const minimized = mode === "minimized";
  // Keep a useful host width on small previews; the requested dock resumes on widening.
  const docked = mode === "sidebar" && viewport.x >= 720;
  const width = minimized ? 244 : Math.min(360, viewport.x - 24);
  const height = minimized ? 52 : docked ? viewport.y : Math.min(660, viewport.y - 24);
  const point = dragPoint ?? (minimized ? anchorPoint(placement.anchor, width, height, viewport) : docked ? { x: viewport.x - width, y: 0 }
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
    clearTimeout(hoverTimer.current); setMenu(false); setFallback(null); setDragPoint(null);
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
    if (mode === "sidebar") setMode("floating");
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
      setMode("floating");
      setPlacement(p => ({ ...p, panel: clampPoint({ x: point.x + dx * (e.shiftKey ? 40 : 10), y: point.y + dy * (e.shiftKey ? 40 : 10) }, width, Math.min(660, viewport.y - 24), viewport) }));
    }
  };
  const menuKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.stopPropagation(); setMenu(false); menuButton.current?.focus(); }
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
    <motion.div className="at-mw-host" data-attune-host animate={{ marginRight: docked ? width : 0 }} transition={reduced ? { duration: 0 } : transition}>{children}</motion.div>
    {createPortal(<AttuneRoot theme={theme} material="frosted" blur={22} opacity={0.82} className="at-mw-root">
      <motion.div ref={shell} className="at-mw-shell at-panel" data-mode={mode} data-docked={docked || undefined} data-anchor={placement.anchor}
        role="region" aria-label="Attune 动效调参" initial={false}
        animate={{ x: point.x, y: point.y, width, height, borderRadius: minimized ? 26 : docked ? 0 : 18 }}
        transition={reduced || dragPoint ? { duration: 0 } : transition}
        onKeyDown={e => { if (e.key === "Escape" && !menu && !minimized) { e.stopPropagation(); changeMode("minimized"); } }}>
        {minimized ? <motion.div key="toolbar" className="at-mw-toolbar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.15 }}>
          {grip}
          <Button iconOnly icon={<Maximize2 size={15} />} aria-label="展开调参面板" title="展开调参面板" onClick={() => changeMode("floating")} />
          <span className="at-mw-divider" />
          <div className="at-mw-play" ref={menuRoot} onKeyDown={menuKeys}
            onPointerEnter={() => clearTimeout(hoverTimer.current)}
            onPointerLeave={() => { hoverTimer.current = setTimeout(() => { if (!menuRoot.current?.contains(document.activeElement)) setMenu(false); }, 180); }}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setMenu(false); }}>
            <Button iconOnly icon={<Play size={15} />} disabled={!definitions.length} aria-label="重播全部动效" title="重播全部动效"
              onPointerEnter={e => { if (e.pointerType === "mouse") setMenu(true); }} onClick={() => replay()} />
            <button ref={menuButton} type="button" className="at-mw-menu-trigger at-icon-btn" aria-label="选择单个动效" aria-haspopup="menu" aria-expanded={menu}
              onClick={() => setMenu(v => !v)} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setMenu(true); requestAnimationFrame(() => menuRoot.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()); } }}><ChevronUp size={13} /></button>
            {menu && <motion.div className="at-mw-menu" role="menu" aria-label="单项动效重播" data-below={point.y < viewport.y / 2 || undefined}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.14 }}>
              <span className="at-mw-menu-caption">独立重播</span>
              {definitions.map(d => <Button key={d.id} role="menuitem" onClick={() => { replay(d.id); menuButton.current?.focus(); }} icon={<Play size={12} />}>{d.label}</Button>)}
              {!definitions.length && <span>当前没有注册动效</span>}
            </motion.div>}
          </div>
          <span className="at-mw-divider" />{copyButton}
        </motion.div> : <motion.div key="expanded" className="at-mw-expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.18 }}>
          <header className="at-mw-head">{grip}<div className="at-mw-heading"><strong>Attune <span>Motion</span></strong><small>{definitions.length} 组动效 · 实时调参</small></div>
            <Button iconOnly icon={mode === "sidebar" ? <Maximize2 size={15} /> : <PanelRight size={15} />} aria-label={mode === "sidebar" ? "切换悬浮面板" : "切换侧边栏"} title={mode === "sidebar" ? "切换悬浮面板" : "切换侧边栏"} onClick={() => changeMode(mode === "sidebar" ? "floating" : "sidebar")} />
            <Button iconOnly icon={<Minimize2 size={15} />} aria-label="收起调参面板" title="收起调参面板" onClick={() => changeMode("minimized")} />
          </header>
          <div className="at-mw-scroll">
            {mode === "sidebar" && !docked && <p className="at-mw-note">窄屏使用悬浮面板，保留页面预览空间。</p>}
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
                if (f.type === "boolean") return <Row key={f.key} label={f.label} hint={f.hint}><Switch aria-label={label} checked={value as boolean} onChange={v => update(d.id, f.key, v)} /></Row>;
                if (f.type === "select") return <Row key={f.key} label={f.label} hint={f.hint}><Select aria-label={label} value={value as string} options={f.options} onChange={v => update(d.id, f.key, v)} /></Row>;
                return <PanelGroup key={f.key} title={f.label} defaultOpen={false}><div className="at-mw-bezier"><BezierEditor size={180} value={value as Bezier} onChange={v => update(d.id, f.key, v)} /></div></PanelGroup>;
              })}
            </PanelGroup>)}
          </div>
          <footer className="at-mw-footer"><Button icon={<Play size={13} />} disabled={!definitions.length} onClick={() => replay()}>重播全部</Button>
            <Button iconOnly icon={<RotateCcw size={14} />} aria-label="恢复面板位置" title="恢复面板位置" onClick={() => { setPlacement({ anchor: "bottom-center", panel: null }); setStatus("位置已恢复"); }} />{copyButton}</footer>
        </motion.div>}
        <div className="at-mw-status" role="status" data-below={point.y < viewport.y / 2 || undefined}>{status}</div>
        {fallback && <div className="at-mw-copy-fallback" data-below={point.y < viewport.y / 2 || undefined}><textarea aria-label="完整动效 JSON，手动复制" readOnly value={fallback} onFocus={e => e.currentTarget.select()} autoFocus /><Button onClick={() => setFallback(null)}>关闭</Button></div>}
      </motion.div>
    </AttuneRoot>, document.body)}
  </>;
}
