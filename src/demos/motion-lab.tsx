import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, Layers, MousePointer2, Sparkles } from "lucide-react";
import { MotionWorkbench } from "../workbench/MotionWorkbench";
import { createMotionConfig, type MotionDefinition, type MotionParams } from "../workbench/model";
import "../styles/attune.css";
import "./motion-lab.css";

const number = (key: string, label: string, value: number, max: number, unit = "ms", step = 10) =>
  ({ type: "number" as const, key, label, default: value, min: 0, max, step, unit });

/** Three adapters exercise entry, hover, and entry/hold/exit without remounting the app. */
function MotionLab() {
  const hero = useRef<HTMLDivElement>(null), hover = useRef<HTMLButtonElement>(null), notice = useRef<HTMLDivElement>(null);
  const runs = useRef(new Map<string, Animation>());
  const [counts, setCounts] = useState({ entrance: 0, hover: 0, notice: 0 });
  const [mounted, setMounted] = useState(true);
  const replay = (id: "entrance" | "hover" | "notice", p: MotionParams) => {
    const el = { entrance: hero, hover, notice }[id].current;
    if (!el) return;
    runs.current.get(id)?.cancel();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = Number(p.duration), hold = Number(p.hold ?? 0), exit = Number(p.exit ?? 0);
    let frames: Keyframe[], timing: KeyframeAnimationOptions;
    if (id === "entrance") {
      frames = [{ opacity: p.fade ? 0 : 1, transform: `translateY(${p.distance}px)` }, { opacity: 1, transform: "translateY(0)" }];
      timing = { duration, delay: Number(p.delay), easing: `cubic-bezier(${(p.easing as number[]).join(",")})`, fill: "both" };
    } else if (id === "hover") {
      const transform = p.direction === "lift" ? `translateY(-${p.distance}px)` : `translateX(${p.distance}px)`;
      frames = [{ transform: "translate(0,0)" }, { transform }, { transform: "translate(0,0)" }];
      timing = { duration: duration * 2, easing: "ease-in-out" };
    } else {
      const total = Math.max(1, duration + hold + exit);
      frames = [{ opacity: 0, transform: "translateY(12px)", offset: 0 },
        { opacity: 1, transform: "translateY(0)", offset: duration / total },
        { opacity: 1, transform: "translateY(0)", offset: (duration + hold) / total },
        { opacity: 0, transform: "translateY(-8px)", offset: 1 }];
      timing = { duration: total, easing: "linear", fill: "both" };
    }
    if (reduce) { frames = [{ opacity: 1, transform: "none" }]; timing = { duration: 0, fill: "forwards" }; }
    runs.current.set(id, el.animate(frames, timing));
    setCounts(c => ({ ...c, [id]: c[id] + 1 }));
  };
  const definitions: MotionDefinition[] = [
    { id: "entrance", label: "卡片入场", description: "从下方轻轻浮入，调整节奏与起始距离。", replay: p => replay("entrance", p), fields: [
      number("duration", "渐入时长", 640, 2000), number("delay", "入场延迟", 0, 1500), number("distance", "起始位移", 28, 100, "px", 1),
      { type: "boolean", key: "fade", label: "透明度渐入", default: true },
      { type: "bezier", key: "easing", label: "缓动曲线", default: [0.16, 1, 0.3, 1] },
    ] },
    { id: "hover", label: "按钮悬停", description: "悬停或独立重播，观察按钮的往返运动。", replay: p => replay("hover", p), fields: [
      number("duration", "单程时长", 240, 1200), number("distance", "悬停位移", 8, 32, "px", 1),
      { type: "select", key: "direction", label: "移动方向", default: "lift", options: [{ value: "lift", label: "向上" }, { value: "slide", label: "向右" }] },
    ] },
    { id: "notice", label: "提示进出场", description: "渐入、留白、渐出，三个阶段独立调整。", replay: p => replay("notice", p), fields: [
      number("duration", "渐入时长", 300, 1500), { ...number("hold", "留白时长", 1000, 4000), control: "number" }, number("exit", "渐出时长", 300, 1500),
    ] },
  ];
  const [config, setConfig] = useState(() => createMotionConfig("attune-first-skill-test", definitions));
  // Each effect depends only on its own parameters. Editing A cannot accidentally replay B/C.
  useEffect(() => { replay("entrance", config.animations.entrance); }, [config.animations.entrance]);
  useEffect(() => { replay("hover", config.animations.hover); }, [config.animations.hover]);
  useEffect(() => { replay("notice", config.animations.notice); }, [config.animations.notice]);
  useEffect(() => { const active = runs.current; return () => { active.forEach(a => a.cancel()); active.clear(); }; }, []);

  const content = <main className="ml-page">
    <nav className="ml-nav"><a href="/showcase.html" className="ml-brand"><span className="ml-mark">a</span>attune<span className="ml-nav-tag">MOTION LAB</span></a><span>Skill preview · 0.1.0</span></nav>
    <section className="ml-intro"><p className="ml-eyebrow">DESIGNED TO FEEL RIGHT</p><h1>让动效，<br /><em>恰到好处。</em></h1><p className="ml-lead">不再说“快一点、再慢一点”。<br />把感觉变成数值，在真实页面上找到合适的节奏。</p><div className="ml-guide"><span>01 展开底部面板</span><span>02 调整并重播</span><span>03 复制参数</span></div></section>
    <section className="ml-experiments" aria-label="三组动效预览">
      <article className="ml-experiment"><header><span>01 / ENTRANCE</span><Layers size={17} /></header><div className="ml-stage"><div ref={hero} className="ml-hero" data-animation="entrance"><div className="ml-orbit"><i /><i /><i /></div><strong>留一点呼吸感。</strong><span>A little room to move.</span></div></div><footer><strong>卡片入场</strong><span data-count="entrance">重播 {counts.entrance} 次</span></footer></article>
      <article className="ml-experiment"><header><span>02 / HOVER</span><MousePointer2 size={17} /></header><div className="ml-stage"><button ref={hover} className="ml-action" data-animation="hover" onPointerEnter={() => replay("hover", config.animations.hover)} onFocus={() => replay("hover", config.animations.hover)}>试着靠近 <ArrowUpRight size={18} /></button><span className="ml-stage-note">HOVER TO EXPLORE</span></div><footer><strong>按钮悬停</strong><span data-count="hover">重播 {counts.hover} 次</span></footer></article>
      <article className="ml-experiment"><header><span>03 / SEQUENCE</span><Sparkles size={17} /></header><div className="ml-stage"><div ref={notice} className="ml-notice" data-animation="notice"><span className="ml-check">✓</span><div><strong>一切刚刚好</strong><span>进场、停留，再轻轻离开。</span></div></div><span className="ml-stage-note">ENTER · HOLD · EXIT</span></div><footer><strong>提示进出场</strong><span data-count="notice">重播 {counts.notice} 次</span></footer></article>
    </section>
    <footer className="ml-bottom"><span>Attune UI 原生控件 · 石墨灰 / 磨砂玻璃</span><button onClick={() => setMounted(v => !v)}>{mounted ? "暂时移除调参工具" : "重新挂载调参工具"}</button><a href="/">查看组件库 <ArrowUpRight size={13} /></a></footer>
    <output className="ml-config" aria-label="当前配置快照">{JSON.stringify(config)}</output>
  </main>;
  // Keep the same layout boundary when disabled; a production integration gates the tool at its entry.
  return mounted ? <MotionWorkbench definitions={definitions} config={config} onChange={setConfig} theme="light">{content}</MotionWorkbench> : content;
}

createRoot(document.getElementById("root")!).render(<MotionLab />);
