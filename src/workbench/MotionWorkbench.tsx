import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { Copy, GripVertical, Maximize2, Minimize2, Play, RotateCcw, SwatchBook } from "lucide-react";
import { AttuneRoot } from "../core/surface";
import { Button } from "../components/Button";
import { ToggleButton } from "../components/ToggleButton";
import { PanelGroup, Row, SliderField, NumberField, TokenField } from "../components/Panel";
import { SwitchField } from "../components/Switch";
import { Select } from "../components/Select";
import { ScrollArea } from "../components/ScrollArea";
import { BezierEditor, type Bezier, type BezierPreset } from "../components/BezierEditor";
import { anchorPoint, anchors, clampPoint, createMotionConfig, nearestAnchor, serializeMotionConfig, snapConfigToTokens, tokensForField, type Anchor, type MotionConfig, type MotionDefinition, type MotionParam, type MotionTokenSet, type Point } from "./model";
import "./workbench.css";

type Mode = "minimized" | "floating";
/**
 * Floating panel height always hugs its sections (collapsed groups → a short panel) and grows as they
 * open, up to a ceiling; past that the board scrolls. The ceiling is the viewport minus `autoMargin` until the designer
 * drags the bottom edge, which sets their own ceiling (remembered); double-click the handle to reset it.
 * A ceiling never adds empty space — the panel stays as short as its content.
 */
const PANEL = { width: 360, autoMargin: 48, minHeight: 260 };
/** Toolbar: 28px buttons with an equal 12px optical inset on all four sides. The 2×3 grip dots
 * span ~5.4px; the 16px icon sits centred in a 12px box, so the dots start ~3.3px inside it. */
const TOOLBAR = { height: 52, width: 9 + 12 + 8 + 28 * 3 + 8 * 2 + 12 };
type Placement = { anchor: Anchor; panel: Point | null; height: number | null };
const readPlacement = (key: string, legacyKey: string): Placement => {
  try {
    const stored = localStorage.getItem(key);
    // v1 stored a fixed height (sometimes set by a stray click); keep its position only.
    const value = stored ? JSON.parse(stored) : { ...JSON.parse(localStorage.getItem(legacyKey) ?? "null"), height: null };
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
  /**
   * The design team's motion tokens (`parseMotionTokens` output). Adds a “启用预设” toggle to the
   * footer; when on, token-matched fields pick from the tokens. Omit to hide the toggle.
   */
  tokens?: MotionTokenSet | null;
  /** @deprecated Use `tokens`. The first set is used as the preset. */
  tokenLibrary?: MotionTokenSet[];
  /** Preset on before the designer has toggled it in this project (their choice is remembered). */
  defaultPresetEnabled?: boolean;
};

/** Client-only preview workbench. Remount with key={projectId} when switching projects. */
export function MotionWorkbench({ definitions, config, onChange, children, theme = "system", tokens: presetProp = null, tokenLibrary = [], defaultPresetEnabled = false }: MotionWorkbenchProps) {
  const storageKey = `attune-motion:placement:v2:${config.projectId}`;
  const presetKey = `attune-motion:preset:v1:${config.projectId}`;
  const preset: MotionTokenSet | null = presetProp ?? tokenLibrary[0] ?? null;
  const [presetOn, setPresetOn] = useState(() => {
    try { const v = localStorage.getItem(presetKey); return v === null ? defaultPresetEnabled : v === "on"; } catch { return defaultPresetEnabled; }
  });
  const tokenSet = preset && presetOn ? preset : null;
  /** Token-mapped fields the designer switched to “自定义” (free slider), keyed "animationId.fieldKey". */
  const [freeFields, setFreeFields] = useState<Record<string, boolean>>({});
  const [placement, setPlacement] = useState(() => readPlacement(storageKey, `attune-motion:placement:v1:${config.projectId}`));
  const [mode, setMode] = useState<Mode>("minimized");
  const [viewport, setViewport] = useState<Point>(() => ({ x: window.innerWidth, y: window.innerHeight }));
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  /** Content height of the expanded panel (header + sections + footer), measured live. */
  const [natural, setNatural] = useState<number | null>(null);
  /** Sections stay as the designer left them across collapse/expand; all start closed. */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  /** False while the panel morphs between toolbar and panel, so that morph keeps its spring. */
  const [settled, setSettled] = useState(false);
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
  // Default ceiling: the viewport less 48px — so fully opened sections can use almost the whole screen.
  const ceiling = Math.min(maxHeight, dragHeight ?? placement.height ?? Math.max(PANEL.minHeight, viewport.y - PANEL.autoMargin));
  const hugging = dragHeight === null;
  const height = minimized ? TOOLBAR.height : Math.min(ceiling, natural ?? ceiling);
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
  // Measure what the expanded panel needs: header + scroll content + footer. Re-measures every frame a
  // section reveal animates, so the panel grows with it.
  useLayoutEffect(() => {
    if (minimized) { setNatural(null); return; }
    const root = shell.current;
    const parts = [".at-mw-head", ".at-scroll-content", ".at-mw-footer"].map(sel => root?.querySelector<HTMLElement>(sel));
    if (parts.some(p => !p)) return;
    const measure = () => setNatural(Math.ceil(parts.reduce((sum, p) => sum + p!.offsetHeight, 0)));
    measure();
    const ro = new ResizeObserver(measure);
    parts.forEach(p => ro.observe(p!));
    return () => ro.disconnect();
  }, [minimized]);
  useEffect(() => {
    setSettled(false);
    const id = setTimeout(() => setSettled(true), 450);
    return () => clearTimeout(id);
  }, [mode]);
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
  // Defaults come from the registered fields, so "reset all" restores every group's source values.
  // With tokens loaded, the baseline is those defaults snapped onto the nearest tokens.
  // Memoized (from the remote perf pass): moving/resizing the panel re-renders the workbench every
  // frame; none of this depends on position, so the parameter tree below can be reused as-is.
  const defaults = useMemo(() => createMotionConfig(config.projectId, definitions), [config.projectId, definitions]);
  const baseline = useMemo(() => tokenSet ? snapConfigToTokens(defaults, definitions, tokenSet).config : defaults, [defaults, definitions, tokenSet]);
  const pristine = useMemo(() => JSON.stringify(baseline.animations) === JSON.stringify(config.animations), [baseline, config.animations]);
  const resetAll = () => { onChange(baseline); setFreeFields({}); setStatus("已重置全部参数"); };

  /* Preset (design tokens): token-matched fields pick from the tokens, easings use them as curve presets. */
  const setPreset = (on: boolean) => {
    setPresetOn(on); setFreeFields({});
    try { localStorage.setItem(presetKey, on ? "on" : "off"); } catch { /* Session memory still works. */ }
    if (!on || !preset) { setStatus("已关闭预设，参数恢复滑块调节"); return; }
    const set = preset;
    const { config: next, snapped, segmented } = snapConfigToTokens(config, definitions, set);
    const easings = definitions.reduce((n, d) => n + d.fields.filter(f => f.type === "bezier" && tokensForField(f, set).length).length, 0);
    if (snapped) onChange(next);
    setStatus(segmented + easings === 0 ? `已启用「${set.name}」，但没有字段匹配（检查单位或字段的 token）`
      : `已启用「${set.name}」：${segmented} 个参数改为 token 选择${easings ? `，${easings} 条曲线使用 token 预设` : ""}${snapped ? `，${snapped} 个值取最近的 token` : ""}`);
  };
  const update = useCallback((id: string, key: string, value: MotionParam) => onChange({ ...config, animations: {
    ...config.animations, [id]: { ...config.animations[id], [key]: value },
  } }), [config, onChange]);
  const replay = useCallback(async (id?: string) => {
    setMenu(false);
    const selected = definitions.filter(d => !id || d.id === id);
    const results = await Promise.allSettled(selected.map(d => Promise.resolve().then(() => d.replay(config.animations[d.id]))));
    const failed = results.flatMap((result, i) => result.status === "rejected" ? [selected[i].label] : []);
    if (failed.length) setStatus(`重播失败：${failed.join("、")}`);
  }, [config, definitions]);
  const copy = async () => {
    const json = serializeMotionConfig(config, definitions, tokenSet);
    try { await navigator.clipboard.writeText(json); setFallback(null); setStatus("完整 JSON 已复制"); }
    catch { setFallback(json); setStatus("剪贴板不可用，请选中下方 JSON 手动复制"); }
  };
  const startDrag = (e: PointerEvent<HTMLElement>) => {
    // The grip sits inside the header: its pointerdown bubbles up, so only start once.
    if (e.button !== 0 || drag.current) return;
    // The whole header is a drag handle, except its other buttons (collapse, …).
    const target = e.target as Element;
    if (target.closest("button, a, input, [role='slider']") && !target.closest(".at-mw-grip")) return;
    const rect = shell.current!.getBoundingClientRect();
    const origin = { x: rect.x, y: rect.y };
    drag.current = { pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin, last: origin, mode };
    e.currentTarget.setPointerCapture(e.pointerId);
    setMenu(false); setDragPoint(origin);
  };
  const moveDrag = (e: PointerEvent<HTMLElement>) => {
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
    // A click (no real drag) must not freeze the auto height; only an actual resize sets it.
    if (Math.abs(s.last - s.origin) >= 2) setPlacement(p => ({ ...p, panel: p.panel ?? point, height: s.last }));
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
    onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={keyboardMove}><GripVertical size={16} /></button>;
  // Parameter tree, reused across position/size/status re-renders; recomputed only when values,
  // definitions, tokens, custom mode or open sections change. Not built while minimized.
  const groups = useMemo(() => minimized ? null : definitions.map(d => <PanelGroup key={d.id} title={d.description ? <span title={d.description}>{d.label}</span> : d.label}
              open={!!openGroups[d.id]} onOpenChange={o => setOpenGroups(g => ({ ...g, [d.id]: o }))}
              // Same size and x as the footer's “重播全部”, so the play buttons form one column.
              leading={<Button iconOnly icon={<Play size={15} />} aria-label={`重播${d.label}`} title={`重播${d.label}`} onClick={() => replay(d.id)} />}>
              {d.fields.map(f => {
                const value = config.animations[d.id][f.key];
                const label = `${d.label} · ${f.label}`;
                const base = baseline.animations[d.id][f.key];
                if (f.type === "number") {
                  // With tokens, a slider over a mixed scale (short/medium/long) is too dense to use:
                  // pick a token from a dropdown, or choose “自定义” to get a free slider back.
                  const options = f.control === "number" ? [] : tokensForField(f, tokenSet);
                  const id = `${d.id}.${f.key}`;
                  if (options.length >= 2) return <TokenField key={f.key} label={f.label} hint={f.hint} value={value as number} min={f.min} max={f.max} step={f.step} unit={f.unit}
                    tokens={options.map(t => ({ value: t.value as number, label: t.label }))}
                    custom={!!freeFields[id]} onCustomChange={c => setFreeFields(m => ({ ...m, [id]: c }))}
                    onChange={v => update(d.id, f.key, v)} modified={value !== base}
                    onReset={() => { update(d.id, f.key, base); setFreeFields(m => ({ ...m, [id]: false })); }} />;
                  const Field = f.control === "number" ? NumberField : SliderField;
                  return <Field key={f.key} label={f.label} hint={f.hint} value={value as number} min={f.min} max={f.max} step={f.step} unit={f.unit}
                    onChange={v => update(d.id, f.key, v)} modified={value !== base} onReset={() => update(d.id, f.key, base)} />;
                }
                // SwitchField keeps the label left and the switch on the right edge, like slider readouts.
                if (f.type === "boolean") return <SwitchField key={f.key} label={f.label} hint={f.hint} checked={value as boolean} onChange={v => update(d.id, f.key, v)} />;
                if (f.type === "select") return <Row key={f.key} label={f.label} hint={f.hint}><Select aria-label={label} width="100%" value={value as string} options={f.options} onChange={v => update(d.id, f.key, v)} /></Row>;
                // Inline in the animation's own group (no second level): the field label names what it controls.
                const curve = value as Bezier;
                const easing = tokensForField(f, tokenSet);
                const presets: BezierPreset[] | undefined = easing.length ? easing.map(t => ({ value: t.name, label: t.label, short: t.label, curve: t.value as Bezier })) : undefined;
                return <Row key={f.key} stacked label={f.label} hint={f.hint} modified={curve.some((n, i) => n !== f.default[i])} onReset={() => update(d.id, f.key, f.default)}>
                  <div className="at-mw-bezier"><BezierEditor size={180} framed presets={presets} presetPicker={!presets || presets.length <= 8 ? "radial" : "select"} value={curve} onChange={v => update(d.id, f.key, v)} /></div></Row>;
              })}
            </PanelGroup>), [minimized, definitions, config.animations, baseline, tokenSet, freeFields, openGroups, update, replay]);
  const copyButton = <Button size="md" iconOnly icon={<Copy size={15} />} aria-label="复制完整 JSON" title="复制完整 JSON" onClick={copy} />;

  return <>
    {children}
    {createPortal(<AttuneRoot theme={theme} material="frosted" blur={24} opacity={0.52} className="at-mw-root">
      <motion.div ref={shell} className="at-mw-shell at-panel" data-mode={mode} data-anchor={placement.anchor} data-resizing={dragHeight !== null || undefined}
        role="region" aria-label="Attune 动效调参" initial={false}
        animate={{ x: point.x, y: point.y, width, height, borderRadius: minimized ? 26 : 24 }}
        transition={reduced || dragPoint || dragHeight !== null ? { duration: 0 }
          // Hugging: height tracks the content's own (already animated) reveal frame by frame.
          : hugging && settled && !minimized ? { ...transition, height: { duration: 0 } } : transition}
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
          <header className="at-mw-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>{grip}<div className="at-mw-heading"><strong>Attune <span>Motion</span></strong></div>
            <Button iconOnly icon={<Minimize2 size={15} />} aria-label="收起调参面板" title="收起调参面板" onClick={() => changeMode("minimized")} />
          </header>
          {/* Parameters live on a raised sheet; header and footer sit on the panel itself. */}
          <div className="at-mw-board">
          <ScrollArea className="at-mw-scroll-area" viewportClassName="at-mw-scroll" scrollbar={false} fade>
            {!definitions.length && <p className="at-mw-note">还没有动效。注册动效后，参数会显示在这里。</p>}
            {groups}
          </ScrollArea>
          </div>
          <footer className="at-mw-footer"><Button iconOnly icon={<Play size={15} />} disabled={!definitions.length} aria-label="重播全部" title="重播全部" onClick={() => replay()} />
            {preset && <ToggleButton icon={<SwatchBook size={14} />} pressed={presetOn} onPressedChange={setPreset} pressedLabel="启用预设"
              aria-label="启用预设" title={presetOn ? `已启用 ${preset.name} · 点击关闭` : `启用预设：${preset.name}`} />}
            <Button iconOnly icon={<RotateCcw size={14} />} disabled={pristine} aria-label="重置全部参数" title="重置全部参数为默认值" onClick={resetAll} />{copyButton}</footer>
          <div className="at-mw-resize" role="separator" aria-orientation="horizontal" aria-label="拖动调整面板高度，方向键调整" tabIndex={0}
            aria-valuemin={PANEL.minHeight} aria-valuemax={maxHeight} aria-valuenow={Math.round(height)}
            onPointerDown={startStretch} onPointerMove={moveStretch} onPointerUp={endStretch} onPointerCancel={endStretch} onLostPointerCapture={endStretch} onKeyDown={keyboardStretch}
            onDoubleClick={() => { setPlacement(p => ({ ...p, height: null })); setStatus("已恢复默认高度上限"); }}
            title="拖动设置最大高度 · 双击恢复默认"><span /></div>
        </motion.div>}
        <div className="at-mw-status" role="status" data-below={point.y < viewport.y / 2 || undefined}>{status}</div>
        {fallback && <div className="at-mw-copy-fallback" data-below={point.y < viewport.y / 2 || undefined}><textarea aria-label="完整动效 JSON，手动复制" readOnly value={fallback} onFocus={e => e.currentTarget.select()} autoFocus /><Button onClick={() => setFallback(null)}>关闭</Button></div>}
      </motion.div>
    </AttuneRoot>, document.body)}
  </>;
}
