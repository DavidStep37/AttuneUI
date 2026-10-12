import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/attune.css";
import "./radial.css";
import { AttuneRoot } from "../core/surface";
import { BezierEditor, CurveGlyph, bezierPresets, type Bezier } from "../components/BezierEditor";
import { RadialPicker, radialFeelDefaults, type RadialFeel } from "../components/RadialPicker";
import { Panel, PanelGroup, Row, SliderField } from "../components/Panel";
import { Segmented } from "../components/Segmented";
import { Select } from "../components/Select";

function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [curve, setCurve] = useState<Bezier>([0.2, 0, 0, 1]);
  const [count, setCount] = useState<"4" | "6" | "8">("8");
  const [pick, setPick] = useState<string>("standard");
  const [feel, setFeel] = useState<RadialFeel>(radialFeelDefaults);
  const set = <K extends keyof RadialFeel>(k: K) => (v: RadialFeel[K]) => setFeel((f) => ({ ...f, [k]: v }));
  const subset = bezierPresets.slice(0, Number(count));
  const options = subset.map((b) => ({ value: b.value, label: b.short, icon: <CurveGlyph curve={b.curve} /> }));

  return (
    <AttuneRoot theme={theme} className="rd-page">
      <header className="rd-head">
        <div>
          <span className="rd-eyebrow">EXPERIMENT · RADIAL PICKER</span>
          <h1>圆盘呼出</h1>
          <p>选项数量固定且不多时，用等分圆盘代替下拉列表。点击后从按钮处浮出，每个选项是嵌在底盘里的一块内芯，和滑块一样留 2.5px 间距；悬停的那块变成石墨色，并和底盘边缘一起向外撑起。也可以按住按钮、朝方向一甩再松开直接选择。</p>
        </div>
        <Segmented aria-label="主题" size="sm" value={theme} onChange={setTheme} options={[{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }]} />
      </header>

      <main className="rd-grid">
        <section className="rd-card rd-card-wide">
          <div className="rd-card-head"><span>01</span><strong>在贝塞尔编辑器里</strong><em>点击下方预设按钮</em></div>
          <div className="rd-stage">
            <BezierEditor value={curve} onChange={setCurve} size={220} presetPicker="radial" />
            <div className="rd-compare">
              <span className="rd-label">对照：原下拉</span>
              <BezierEditor value={curve} onChange={setCurve} size={120} showInputs={false} showPreview={false} />
            </div>
          </div>
        </section>

        <section className="rd-card">
          <div className="rd-card-head"><span>02</span><strong>等分</strong><em>4 / 6 / 8 个选项</em></div>
          <div className="rd-stage rd-stage-center">
            <RadialPicker aria-label="缓动预设" value={subset.some((b) => b.value === pick) ? pick : null} onChange={setPick} options={options} feel={feel}
              renderHub={(o) => {
                const pr = bezierPresets.find((b) => b.value === o?.value);
                return pr ? <span className="at-radial-hub-preview"><CurveGlyph curve={pr.curve} size={34} strokeWidth={1.8} /><span>{pr.short}</span></span> : <span className="at-radial-hub-label">—</span>;
              }} />
            <Segmented aria-label="选项数量" size="sm" value={count} onChange={setCount} options={[{ value: "4", label: "4" }, { value: "6", label: "6" }, { value: "8", label: "8" }]} />
            <span className="rd-label">键盘：Enter 打开 · ← → 旋转 · 1–{count} 直选 · Esc 关闭</span>
          </div>
        </section>

        <section className="rd-card">
          <div className="rd-card-head"><span>03</span><strong>常规下拉</strong><em>同一组选项，对比手感</em></div>
          <div className="rd-stage rd-stage-center">
            <Select aria-label="缓动预设（下拉）" value={pick} onChange={setPick} width={180} options={bezierPresets.map((b) => ({ value: b.value, label: b.label }))} />
          </div>
        </section>

        <Panel className="rd-panel" title="圆盘手感" subtitle="只作用于 02 的圆盘">
          <PanelGroup title="形状">
            <SliderField label="圆盘半径" value={feel.radius} onChange={set("radius")} min={90} max={170} step={1} unit="px" />
            <SliderField label="中心半径" value={feel.hubRadius} onChange={set("hubRadius")} min={30} max={70} step={1} unit="px" />
            <SliderField label="内外间距" value={feel.gap} onChange={set("gap")} min={0} max={6} step={0.25} unit="px" />
          </PanelGroup>
          <PanelGroup title="悬停鼓包">
            <SliderField label="局部撑起" value={feel.bulge} onChange={set("bulge")} min={0} max={16} step={0.5} unit="px" />
            <SliderField label="撑起范围" value={feel.bulgeWidth} onChange={set("bulgeWidth")} min={0.2} max={1.5} step={0.05} unit="×扇区" />
            <Row label="重置"><button type="button" className="rd-reset" onClick={() => setFeel(radialFeelDefaults)}>恢复默认</button></Row>
          </PanelGroup>
        </Panel>
      </main>
    </AttuneRoot>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
