import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { AttuneProvider } from "../../core/feel";
import { useSize } from "../../core/hooks";
import { IconExternal, IconDownLeft, IconDownRight, IconShape, IconRespond, IconConnect } from "../../core/icons";
import { Button } from "../../components/Button";
import { SliderField } from "../../components/Panel";
import { Segmented } from "../../components/Segmented";
import { Switch, SwitchField } from "../../components/Switch";
import { ValueRoll } from "../../components/ValueRoll";
import { Gallery, ORDER } from "../Gallery";
import { Sample } from "../Sample";
import { Logo, IconReplay } from "../icons";
import { DemoProvider, StoreProvider, usePlaygroundStore, type Theme } from "../store";
import { directions, directionCSS, getDirection, type Direction } from "./directions";
import { attachLiquidLens, attachSpecular } from "./liquidLens";
import "./proposals.css";

const FORMS: Record<number, string> = { 1: "ONE", 2: "TWO", 3: "THREE", 4: "FOUR", 5: "FIVE" };
const FORMS_CN: Record<number, string> = { 1: "一", 2: "两", 3: "三", 4: "四", 5: "五" };

export function Proposals() {
  const [direction, setDirection] = useState(() => getDirection(new URLSearchParams(location.search).get("proposal")));
  useEffect(() => {
    const sync = () => setDirection(getDirection(new URLSearchParams(location.search).get("proposal")));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const select = (d: Direction) => {
    const url = new URL(location.href);
    url.searchParams.set("proposal", d.id);
    history.pushState(null, "", url);
    setDirection(d);
  };
  return <>
    <style>{directionCSS}</style>
    <DemoProvider><Study key={direction.id} direction={direction} onSelect={select} /></DemoProvider>
  </>;
}

function Study({ direction: d, onSelect }: { direction: Direction; onSelect: (d: Direction) => void }) {
  const store = usePlaygroundStore(`attune-proposal-${d.id}-v1`, d.baseline, d.theme);
  const [view, setView] = useState<"components" | "sample">("components");
  const [exportStatus, setExportStatus] = useState("");
  const shellRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    document.documentElement.dataset.proposal = d.id;
    return () => { delete document.documentElement.dataset.proposal; };
  }, [d.id]);
  // Liquid Glass: edge refraction on hero glass and component cards, pointer-driven specular light.
  useEffect(() => {
    const shell = shellRef.current;
    if (d.id !== "liquid" || !shell || store.state.reduced) return;
    const detachLens = attachLiquidLens(shell, [
      { selector: ".study-object", options: { bezel: 26, scale: 58, blur: 1.5, saturate: 170 } },
      { selector: ".pg-card", options: { bezel: 20, scale: 30, blur: 18, saturate: 180 } },
      { selector: ".study-choice[aria-pressed='true']", options: { bezel: 12, scale: 14, blur: 14, saturate: 180 } },
    ]);
    const detachLight = attachSpecular(shell, ".pg-card, .study-object, .study-lab, .at-btn, .study-choice, .study-header");
    return () => { detachLens(); detachLight(); };
  }, [d.id, store.state.reduced]);
  const exportStudy = () => {
    const payload = { proposal: d.id, name: d.name, theme: store.state.theme, feel: store.feel, sources: d.sources };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `attune-${d.id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportStatus("方案配置已导出");
  };
  return <StoreProvider store={store}><AttuneProvider value={store.feel}><MotionConfig reducedMotion={store.state.reduced ? "always" : "never"}>
    <div className="study-shell" ref={shellRef}>
      <header className="study-header">
        <a className="study-brand" href="/" aria-label="Attune UI 原版"><Logo /><strong>attune<span> / explorations</span></strong></a>
        <span className="study-edition">DESIGN STUDIES — VOL. 01</span>
        <div className="study-tools">
          <label className="study-reduced"><Switch aria-label="减弱动效" checked={store.state.reduced} onChange={store.setReduced} /><span title="开启时跳过描边和缩放；关闭可预览完整交互">{store.state.reduced ? "减弱动效：绘制／缩放已关闭" : "减弱动效"}</span></label>
          <Segmented aria-label="提案主题" size="sm" value={store.state.theme} onChange={(v) => store.setTheme(v as Theme)} options={[{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }, { value: "system", label: "系统" }]} />
          <a className="study-original" href="/">原版 <IconExternal /></a>
        </div>
      </header>
      <div className="study-layout">
        <aside className="study-sidebar">
          <div className="study-nav-heading"><span>视觉提案</span><span>{String(directions.length).padStart(2, "0")}</span></div>
          <nav aria-label="样式提案">{directions.map((item) => <button key={item.id} className="study-choice" aria-pressed={item.id === d.id} onClick={() => onSelect(item)}>
            <span className={`study-mini mini-${item.id}`} aria-hidden="true"><i /><i /><i /><b /></span>
            <span className="study-choice-copy"><small>{item.number} / {item.en}</small><strong>{item.name}</strong></span>
            <span className="study-choice-arrow" aria-hidden="true"><IconExternal /></span>
          </button>)}</nav>
          <div className="study-sidebar-note"><span className="study-dot" /> SAME SOUL, {FORMS[directions.length] ?? directions.length} FORMS.<p>同一套交互逻辑，<br />{FORMS_CN[directions.length] ?? directions.length}种不同的表达。</p><span>每套参数独立保存。</span></div>
          <a className="study-research-link" href="#research">设计依据与参考 <IconDownRight /></a>
        </aside>
        <main className="study-main">
          <div className="study-breadcrumb"><span>ATTUNE UI / MATERIAL EXPLORATIONS</span><span>PROPOSAL {d.number} — {String(directions.length).padStart(2, "0")}</span></div>
          <section className="study-intro" aria-labelledby="study-title">
            <div><div className="study-eyebrow">{d.en.toUpperCase()} <span>— {d.name}</span></div><h1 id="study-title">{d.title}</h1></div>
            <div className="study-intro-aside"><p className="study-subtitle">{d.subtitle}</p><p>{d.description}</p><div className="study-swatches" aria-label="提案色板">{[d.light[0], d.light[2], d.light[5], d.light[8], d.light[9]].map((c, i) => <span key={i} style={{ background: c }} title={c} />)}<small>{d.material}</small></div></div>
          </section>
          <LiveStudy direction={d} reduced={store.state.reduced} />
          <section className="study-components" aria-label="组件体验">
            <div className="study-section-head"><div><span className="study-eyebrow">THE COMPONENTS</span><h2>从一个动作，到一套语言<span>{String(ORDER.length).padStart(2, "0")}</span></h2></div><Segmented aria-label="提案展示" value={view} onChange={setView} options={[{ value: "components", label: "组件全览" }, { value: "sample", label: "动效样例" }]} /></div>
            <p className="study-section-note">直接操作组件，或点击卡片标题展开手感面板。拖拽、边界阻力与环境联动保持一致。</p>
            {view === "components" ? <Gallery /> : <Sample floating={false} />}
          </section>
          <section className="study-research" id="research">
            <div className="study-research-title"><span className="study-eyebrow">DESIGN NOTES / {d.notesDate}</span><h2>为什么是这个方向</h2><div className="study-tags">{d.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
            <div className="study-research-copy"><p>{d.evidence}</p><dl><div><dt>适合场景</dt><dd>{d.bestFor}</dd></div><div><dt>手感基线</dt><dd>{d.motion}</dd></div><div><dt>设计取舍</dt><dd>{d.tradeoff}</dd></div></dl><div className="study-sources">{d.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}</div></div>
          </section>
          <footer className="study-footer"><span>ATTUNE / {d.en.toUpperCase()}<small>让关联，随交互显现。</small></span><div><span role="status">{exportStatus}</span><Button onClick={store.resetAll}>重置本方案手感</Button><Button variant="primary" onClick={exportStudy}>导出方案配置 <IconExternal /></Button></div></footer>
        </main>
      </div>
    </div>
  </MotionConfig></AttuneProvider></StoreProvider>;
}

function LiveStudy({ direction: d, reduced }: { direction: Direction; reduced: boolean }) {
  const [distance, setDistance] = useState(80);
  const [duration, setDuration] = useState(320);
  const [stagger, setStagger] = useState(true);
  const [replay, setReplay] = useState(0);
  const [order, setOrder] = useState<"forward" | "reverse">("forward");
  const [artRef, artSize] = useSize<HTMLDivElement>();
  const spacing = distance * Math.min(1.6, Math.max(0.6, (artSize.width - 136) / 180));
  return <section className="study-lab" aria-label="交互预览">
    <div className="study-stage">
      <div className="study-stage-head"><span><i className="study-dot" /> LIVE CANVAS</span><span>01 — 交错与空间</span></div>
      <div className="study-art" ref={artRef}>
        <div className="study-orbit orbit-one" /><div className="study-orbit orbit-two" />
        <div className="study-cross cross-one">+</div><div className="study-cross cross-two">+</div>
        {[0, 1, 2].map((i) => <motion.div className={`study-object object-${i}`} key={`${replay}-${i}`} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 26, x: (i - 1) * spacing }} animate={{ opacity: 1, y: i === 1 ? -12 : 12, x: (i - 1) * spacing }} transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: duration / 1000, bounce: d.baseline.springs.soft.bounce, delay: stagger ? (order === "forward" ? i : 2 - i) * 0.07 : 0 }}>
          <span className="study-object-index">0{i + 1}<IconExternal size={11} /></span>
          {i === 0 ? <IconShape className="study-glyph" /> : i === 1 ? <IconRespond className="study-glyph" /> : <IconConnect className="study-glyph" />}
          <strong>{["Shape", "Respond", "Connect"][i]}</strong><span className="study-object-label">{["形态", "回应", "关联"][i]} / {d.en}</span>
        </motion.div>)}
      </div>
      <div className="study-stage-foot"><span>← 调整间距，感知关系 →</span><span className="study-measure"><ValueRoll value={distance} text={String(distance)} /> px</span></div>
    </div>
    <div className="study-inspector">
      <div className="study-inspector-head"><div><span className="study-eyebrow">MOTION CONTROLS</span><h2>调一调，感受不同。</h2></div><span><IconDownLeft size={23} /></span></div>
      <SliderField label="展开间距" value={distance} onChange={setDistance} min={24} max={90} step={1} unit="px" />
      <SliderField label="过渡时长" value={duration} onChange={setDuration} min={100} max={900} step={10} unit="ms" />
      <div className="study-divider" />
      <SwitchField label="交错入场" checked={stagger} onChange={setStagger}>
        <Segmented aria-label="预览入场顺序" value={order} onChange={setOrder} fullWidth options={[{ value: "forward", label: "从左到右 →" }, { value: "reverse", label: "← 从右到左" }]} />
      </SwitchField>
      <div className="study-inspector-actions"><span>{reduced ? "即时反馈" : "可打断 · 可反向"}</span><Button variant="primary" icon={<IconReplay />} onClick={() => setReplay((v) => v + 1)}>重播</Button></div>
    </div>
  </section>;
}
