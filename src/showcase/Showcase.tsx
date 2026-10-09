import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowUpRight, Check, Code2, Copy, ExternalLink, Moon, MoveUpRight, Play, RotateCcw, SlidersHorizontal, Sun } from "lucide-react";
import { AttuneRoot, Button, Checkbox, NumberInput, Panel, PanelGroup, Row, Segmented, Select, Slider, SliderField, Switch, Tabs, Toast, BezierEditor, Timeline, useFeelState, type AttuneMaterial, type Bezier, type ControlSize, type TimelineItem } from "../index";

const repository = "https://github.com/DavidStep37/AttuneUI";
const rootExample = `import { useState } from "react";
import { AttuneRoot, Panel, SliderField } from "./components/attune";
import "./components/attune/styles/attune.css";

export function MotionTools() {
  const [duration, setDuration] = useState(300);
  return (
    <AttuneRoot theme="system" material="frosted" blur={18}>
      <Panel floating title="Motion tools">
        <SliderField label="Duration" value={duration}
          onChange={setDuration} min={100} max={1000}
          step={10} unit="ms" />
      </Panel>
    </AttuneRoot>
  );
}`;

function Mark() {
  return <svg width="27" height="27" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 16c0-3 2-4 5-4 3 0 4-4 8-4s5 4 8 4c3 0 5 1 5 4s-2 4-5 4c-3 0-4 4-8 4s-5-4-8-4c-3 0-5-1-5-4Z" fill="var(--at-color-surface-sunken)" stroke="var(--at-color-border-strong)"/><rect x="13" y="10" width="6" height="12" rx="3" fill="currentColor"/></svg>;
}

function CopyButton({ text, label = "复制代码" }: { text: string; label?: string }) {
  const [status, setStatus] = useState("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setStatus("已复制"); }
    catch { setStatus("复制失败，请手动选择下方代码"); }
  };
  return <span className="sc-copy-wrap"><button className="sc-copy" type="button" onClick={copy}>{status === "已复制" ? <Check size={14} /> : <Copy size={14} />}{label}</button><span className="sc-copy-status" role="status">{status}</span></span>;
}

type DemoCardProps = { number: string; title: string; description: string; children: ReactNode; lab?: boolean };
function DemoCard({ number, title, description, children, lab }: DemoCardProps) {
  return <article className="sc-component" data-demo={title}>
    <div className="sc-component-top"><span>{number}</span><span>{lab ? "EXPERIMENTAL" : "INTERACTIVE"}</span></div>
    <div className="sc-component-demo">{children}</div>
    <div className="sc-component-caption"><h3>{title}</h3><p>{description}</p></div>
  </article>;
}

function Collection({ size }: { size: ControlSize }) {
  const [value, setValue] = useState(64);
  const [number, setNumber] = useState(240);
  const [axis, setAxis] = useState("x");
  const [on, setOn] = useState(true);
  const [easing, setEasing] = useState("ease-out");
  const [checked, setChecked] = useState(true);
  const [tab, setTab] = useState("motion");
  const [toast, setToast] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [curve, setCurve] = useState<Bezier>([0.2, 0, 0, 1]);
  const [items, setItems] = useState<TimelineItem[]>([{ id: "a", label: "位移", delay: 0, duration: 400 }, { id: "b", label: "淡入", delay: 100, duration: 240 }]);
  return <div className="sc-collection">
    <DemoCard number="01" title="Slider" description="拖动白点，感受轨道的让位与回弹。"><div className="sc-demo-wide"><div className="sc-demo-label"><span>Intensity</span><span>{value}%</span></div><Slider size={size} value={value} onChange={setValue} min={0} max={100} step={1} aria-label="Intensity" /></div></DemoCard>
    <DemoCard number="02" title="NumberInput" description="划过描边，点击编辑，也可以拖动调值。"><NumberInput size={size} value={number} onChange={setNumber} min={0} max={1000} step={10} unit="ms" aria-label="示例时长" /></DemoCard>
    <DemoCard number="03" title="Button" description="靠近时轻轻吸引，按下时给出反馈。"><div className="sc-demo-stack"><Button size={size} variant="primary" icon={<Play size={12} />} onClick={() => setClicks(c => c + 1)}>Run animation</Button><span className="sc-small" aria-live="polite">{clicks ? `已运行 ${clicks} 次` : "靠近 · 按下 · 松开"}</span></div></DemoCard>
    <DemoCard number="04" title="Segmented" description="连续滑动的选中底色，随时可以改变方向。"><Segmented size={size} value={axis} onChange={setAxis} options={[{ value: "x", label: "Position" }, { value: "y", label: "Scale" }, { value: "z", label: "Rotate" }]} aria-label="变换类型" /></DemoCard>
    <DemoCard number="05" title="Switch" description="白色手柄，软轨道，干净利落的切换。"><div className="sc-switch-demo"><span>Enable motion</span><Switch size={size} checked={on} onChange={setOn} aria-label="Enable motion" /></div></DemoCard>
    <DemoCard number="06" title="Select" description="列表从入口生长，方向键也能选择。"><Select size={size} value={easing} onChange={setEasing} aria-label="示例缓动" width={170} options={[{ value: "ease-out", label: "Ease out" }, { value: "ease-in", label: "Ease in" }, { value: "linear", label: "Linear" }]} /></DemoCard>
    <DemoCard number="07" title="Checkbox" description="轻按收缩，勾选弹回。支持半选状态。"><Checkbox size={size} checked={checked} onChange={setChecked}>Snap to grid</Checkbox></DemoCard>
    <DemoCard number="08" title="Tabs" description="让参数各归其位，键盘焦点始终有迹可循。"><Tabs size={size} value={tab} onChange={setTab} aria-label="示例标签页" items={[{ value: "motion", label: "Motion", content: <span className="sc-small">调节时长、弹性和缓动曲线。</span> }, { value: "style", label: "Style", content: <span className="sc-small">调整颜色、面板圆角与材质。</span> }]} /></DemoCard>
    <DemoCard number="09" title="Feedback" description="轻盈出现，自然消散。此处展示单条 Toast。"><Button size={size} icon={<Check size={13} />} onClick={() => setToast(true)} disabled={toast}>Apply changes</Button><Toast open={toast} onDismiss={() => setToast(false)} tone="success">参数已更新，可以继续创作。</Toast></DemoCard>
    <DemoCard number="10" title="BezierEditor" description="直接牵拉曲线，把抽象缓动变得可触摸。" lab><BezierEditor value={curve} onChange={setCurve} size={110} showInputs={false} showPresets={false} showTrack={false} showPreview={false} /></DemoCard>
    <DemoCard number="11" title="Timeline" description="移动横条或拉伸两端，编排动作的先后。" lab><Timeline items={items} onChange={(id, next) => setItems(list => list.map(item => item.id === id ? { ...item, ...next } : item))} range={800} labelWidth={32} aria-label="示例时间轴" /></DemoCard>
    <article className="sc-component sc-component-last"><SlidersHorizontal size={25} strokeWidth={1.25} /><h3>Better together.</h3><p>把这些小控件，组合成你的下一块工具面板。</p><a href="./#sample">打开完整动效样例 <ArrowUpRight size={15} /></a></article>
  </div>;
}

function Studio({ theme, material, blur, opacity, radius }: { theme: "light" | "dark"; material: AttuneMaterial; blur: number; opacity: number; radius: number }) {
  const { reduced } = useFeelState();
  const [duration, setDuration] = useState(600);
  const [bounce, setBounce] = useState(0.3);
  const [mode, setMode] = useState("float");
  const [enabled, setEnabled] = useState(true);
  const [run, setRun] = useState(0);
  const [floating, setFloating] = useState(false);
  const preset = `// 当前舞台的 Motion 动画参数\nconst transition = {\n  type: "spring",\n  visualDuration: ${duration / 1000},\n  bounce: ${bounce},\n};`;
  const fields = <>
    <PanelGroup title="ANIMATION"><Row label="动作"><Segmented aria-label="舞台动作" value={mode} onChange={v => { setMode(v); setRun(r => r + 1); }} options={[{ value: "float", label: "浮起" }, { value: "slide", label: "滑入" }, { value: "scale", label: "缩放" }]} /></Row><SliderField label="时长" value={duration} onChange={setDuration} min={100} max={1400} step={10} unit="ms" /><SliderField label="弹性" value={bounce} onChange={setBounce} min={0} max={0.8} step={0.01} /><Row label="启用动效"><Switch checked={enabled} onChange={setEnabled} aria-label="启用舞台动效" /></Row></PanelGroup>
  </>;
  const actions = <><Button variant="primary" icon={<Play size={12} />} onClick={() => setRun(r => r + 1)}>重播</Button><Button variant="ghost" icon={<RotateCcw size={12} />} onClick={() => { setDuration(600); setBounce(0.3); setMode("float"); setEnabled(true); setRun(r => r + 1); }}>重置</Button></>;
  return <>
    <div className="sc-stage" data-testid="studio">
      <div className="sc-stage-top"><span><i /> LIVE CANVAS</span><button type="button" onClick={() => setFloating(true)} className="sc-text-button" disabled={floating}>挂到页面 <MoveUpRight size={13} /></button></div>
      <div className="sc-orbit sc-orbit-one" /><div className="sc-orbit sc-orbit-two" />
      <span className="sc-stage-cross sc-cross-one">+</span><span className="sc-stage-cross sc-cross-two">+</span>
      <div className="sc-object-space" aria-hidden="true"><motion.div key={`${run}-${enabled}`} className="sc-object" initial={!enabled || reduced ? false : { opacity: 0, y: mode === "float" ? 75 : 0, x: mode === "slide" ? -80 : 0, scale: mode === "scale" ? 0.4 : 1, rotate: -25 }} animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: -12 }} transition={!enabled || reduced ? { duration: 0 } : { type: "spring", visualDuration: duration / 1000, bounce }}><div className="sc-object-core" /><span className="sc-object-line" /><span className="sc-object-dot" /></motion.div><span className="sc-object-shadow" /></div>
      <AttuneRoot theme={theme} material={material} blur={blur} opacity={opacity} panelRadius={radius} className="sc-studio-scope">
        <Panel title={<span className="sc-panel-title"><SlidersHorizontal size={13} /> Motion tools</span>} subtitle="一点调整，即刻有感。" className="sc-demo-panel" footer={actions}>{fields}</Panel>
      </AttuneRoot>
      <div className="sc-stage-bottom"><span>01 / MOTION STUDY</span><span>{duration} ms <span className="sc-stage-divider">/</span> {bounce.toFixed(2)} bounce</span></div>
    </div>
    <div className="sc-stage-note"><span>真实组件，直接上手。调整后点击重播。</span><details className="sc-preset"><summary>获取动画参数 <Code2 size={13} /></summary><div><CopyButton text={preset} /><pre>{preset}</pre></div></details></div>
    {floating && <AttuneRoot theme={theme} material={material} blur={blur} opacity={opacity} panelRadius={radius}><Panel floating title="Motion tools" subtitle="拖动标题移动 · 与舞台同步" className="sc-floating-panel" onClose={() => setFloating(false)} footer={actions}>{fields}</Panel></AttuneRoot>}
  </>;
}

export function Showcase() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [material, setMaterial] = useState<AttuneMaterial>("frosted");
  const [size, setSize] = useState<ControlSize>("md");
  const [blur, setBlur] = useState(18);
  const [opacity, setOpacity] = useState(0.78);
  const [radius, setRadius] = useState(16);
  const themeCode = `<AttuneRoot\n  theme="${theme}"\n  material="${material}"\n  blur={${blur}}\n  opacity={${opacity}}\n  panelRadius={${radius}}\n>\n  {/* Your tools, your page. */}\n</AttuneRoot>`;
  return <AttuneRoot theme={theme} className="sc-site" data-site-theme={theme}>
    <a className="sc-skip" href="#main">跳到主要内容</a>
    <header className="sc-nav sc-container"><a className="sc-brand" href="./showcase.html"><Mark /><strong>attune<span>ui</span></strong></a><nav aria-label="主导航"><a href="#components">组件</a><a href="#material">材质</a><a href="#start">开始使用</a></nav><div className="sc-nav-end"><span className="sc-preview">EARLY PREVIEW</span><a href={repository} aria-label="GitHub 源码" target="_blank" rel="noreferrer"><Code2 size={18} /></a><button className="sc-theme-toggle" type="button" aria-label={theme === "light" ? "切换深色" : "切换浅色"} onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button></div></header>
    <main id="main" className="sc-container">
      <section className="sc-hero" aria-labelledby="hero-title">
        <div className="sc-hero-copy"><p className="sc-eyebrow"><span /> BUILT TO BE FELT.</p><h1 id="hero-title">Small controls.<br />A little more<br /><em>feeling.</em></h1><p className="sc-lede">让工具，也有好手感。</p><p className="sc-intro">为创作工具与悬浮调试面板而做的 React 组件。<br className="sc-desktop-break" />轻轻靠近、拖动、松手，让反馈自然发生。</p><div className="sc-hero-links"><a className="sc-primary-link" href="#components">亲手试一试 <ArrowDown size={15} /></a><a className="sc-secondary-link" href="#start">把源码带走 <ArrowUpRight size={15} /></a></div><div className="sc-hero-meta"><span>React + TypeScript</span><span>可调手感</span><span>源码分发预览</span></div></div>
        <div className="sc-hero-demo"><Studio theme={theme} material={material} blur={blur} opacity={opacity} radius={radius} /></div>
      </section>
      <div className="sc-principles"><div><span>01</span><strong>反馈有形，数值安定。</strong><p>外形随交互变化，文字与布局各守其位。</p></div><div><span>02</span><strong>悬浮于内容之上。</strong><p>原始石墨灰，叠加克制的背景模糊。</p></div><div><span>03</span><strong>源码在你的项目里。</strong><p>从一组小控件开始，按自己的需要修改。</p></div></div>
      <section id="components" className="sc-section" aria-labelledby="components-title"><div className="sc-section-heading"><div><p className="sc-eyebrow">THE COLLECTION / 11</p><h2 id="components-title">先动手，再了解。</h2><p>每一格都是真实组件。完整参数和组合示例，在 Playground 里。</p></div><div className="sc-section-tools"><Segmented aria-label="组件尺寸" size="sm" value={size} onChange={setSize} options={[{ value: "sm", label: "24" }, { value: "md", label: "28" }, { value: "lg", label: "32" }]} /><a href="./">Playground <ArrowUpRight size={14} /></a></div></div><Collection size={size} /><p className="sc-collection-note">当前为开发预览。BezierEditor / Timeline 以实验组件展示；尚未承诺完整触屏和跨浏览器支持。</p></section>
      <section id="material" className="sc-section sc-material" aria-labelledby="material-title"><div className="sc-material-copy"><p className="sc-eyebrow">YOUR PAGE. YOUR SURFACE.</p><h2 id="material-title">一点通透，<br />一层恰好的距离。</h2><p>不必换一套配色。让背景透过面板，保留文字、轨道和白色手柄的清晰层次。</p><p>选择实底或毛玻璃，调节模糊、底色覆盖率和面板圆角。上方舞台也会同步变化。</p><a href="#main" className="sc-text-link">回到舞台看看 <ArrowUpRight size={14} /></a><div className="sc-material-controls"><Row label="表面"><Segmented value={material} onChange={setMaterial} aria-label="表面材质" options={[{ value: "solid", label: "实底" }, { value: "frosted", label: "毛玻璃" }]} /></Row><SliderField label="背景模糊" value={blur} onChange={setBlur} min={0} max={32} step={1} unit="px" disabled={material === "solid"} /><SliderField label="底色覆盖" value={opacity} onChange={setOpacity} min={0.55} max={1} step={0.01} disabled={material === "solid"} /><SliderField label="面板圆角" value={radius} onChange={setRadius} min={0} max={28} step={1} unit="px" /></div></div><div className="sc-material-right"><div className="sc-material-stage"><div className="sc-material-type" aria-hidden="true">Aa<br /><span>attune.</span></div><div className="sc-material-stripe" /><AttuneRoot theme={theme} material={material} blur={blur} opacity={opacity} panelRadius={radius}><Panel title="A surface of your own" subtitle="原始配色 · 局部主题" className="sc-material-panel"><PanelGroup title="PREVIEW"><Row label="材质"><span>{material === "frosted" ? "Frosted graphite" : "Solid graphite"}</span></Row><Row label="背景模糊"><span>{material === "frosted" ? blur : 0} px</span></Row><Row label="面板圆角"><span>{radius} px</span></Row><Button onClick={() => setTheme(t => t === "light" ? "dark" : "light")} icon={<Sun size={13} />}>切换明暗主题</Button></PanelGroup></Panel></AttuneRoot></div><div className="sc-code sc-theme-code"><div className="sc-code-top"><span>surface.tsx</span><CopyButton text={themeCode} /></div><pre><code>{themeCode}</code></pre></div></div></section>
      <section id="start" className="sc-section sc-start" aria-labelledby="start-title"><div><p className="sc-eyebrow">TAKE IT WITH YOU.</p><h2 id="start-title">从你的第一块<br />工具面板开始。</h2><p>源码拷贝优先。保留 tokens、core、components 和 styles 的相对目录，就能组合自己的面板。</p><ol className="sc-steps"><li><span>01</span><div><strong>取得源码</strong><p>将 src 下的组件基础目录与 index.ts 拷贝到 components/attune。</p></div></li><li><span>02</span><div><strong>安装运行依赖</strong><p>使用 React 19 项目，添加 motion 与 lucide-react。已验证版本见接入指南。</p></div></li><li><span>03</span><div><strong>引入样式，挂载面板</strong><p>AttuneRoot 管理局部主题和系统动效偏好，然后接入你的状态。</p></div></li></ol><div className="sc-start-links"><a href="./getting-started.md" download>下载接入指南 <ArrowDown size={14} /></a><a href={repository} target="_blank" rel="noreferrer">查看仓库 <ExternalLink size={13} /></a></div><p className="sc-small sc-release-note">源码分发仍处于预览阶段，公开发布前将确定许可证与版本支持范围。Registry 草案已生成，尚未作为正式安装服务发布。</p></div><div className="sc-code sc-main-code"><div className="sc-code-top"><span><Code2 size={14} /> motion-tools.tsx</span><CopyButton text={rootExample} /></div><pre><code>{rootExample}</code></pre><div className="sc-code-foot"><span>局部主题 · 可选毛玻璃 · 系统减弱动效</span><a href="./r/attune-ui.json" download>Registry JSON <ArrowDown size={12} /></a></div></div></section>
      <section className="sc-closing"><Mark /><p>Good tools get out of the way.<br /><em>Great ones feel right.</em></p><a href="./#sample">看看它们一起工作的样子 <ArrowUpRight size={15} /></a></section>
    </main>
    <footer className="sc-footer sc-container"><span>attune ui <span className="sc-footer-dot">/</span> Made for the way you work.</span><div><span>0.1 · 开发预览</span><a href={repository} target="_blank" rel="noreferrer">Source <ArrowUpRight size={12} /></a><a href="./">Playground <ArrowUpRight size={12} /></a></div></footer>
  </AttuneRoot>;
}
