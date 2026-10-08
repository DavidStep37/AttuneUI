import { useState } from "react";
import { Button } from "../components/Button";
import { NumberInput } from "../components/Input";
import { Select } from "../components/Select";
import { Segmented } from "../components/Segmented";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { Checkbox } from "../components/Checkbox";
import { controlHeight, type ControlSize } from "../tokens/tokens";

function SizeRow({ size, label }: { size: ControlSize; label: string }) {
  const [value, setValue] = useState(320);
  const [choice, setChoice] = useState("a");
  const [enabled, setEnabled] = useState(true);
  const [checked, setChecked] = useState(true);
  const options = [{ value: "a", label: "平滑" }, { value: "b", label: "弹性" }];
  return <div className="pg-size-example" data-density={size}>
    <div className="pg-size-label"><strong>{label}</strong><span>{controlHeight(size)} px · 12 / 16 文字</span></div>
    <div className="pg-size-controls">
      <Button size={size} onClick={() => setValue(320)}>重置</Button>
      <Select size={size} aria-label={`${label}缓动`} options={options} value={choice} onChange={setChoice} width={100} />
      <Segmented size={size} aria-label={`${label}模式`} options={options} value={choice} onChange={setChoice} />
      <NumberInput size={size} aria-label={`${label}时长`} value={value} onChange={setValue} min={0} max={1000} unit="ms" />
      <div className="pg-size-slider"><Slider size={size} aria-label={`${label}滑块`} value={value} onChange={setValue} min={0} max={1000} /></div>
      <Switch size={size} aria-label={`${label}开关`} checked={enabled} onChange={setEnabled} />
      <Checkbox size={size} checked={checked} onChange={setChecked}>启用</Checkbox>
    </div>
  </div>;
}

export function SizingGuide() {
  return <section className="pg-sizing" id="sizing" aria-labelledby="sizing-title">
    <h2 id="sizing-title">尺寸与组合</h2>
    <p>同排使用同一尺寸档。小控件保持视觉比例，悬停与聚焦向外展开，文字和相邻组件保持原位。</p>
    <SizeRow size="sm" label="紧凑" />
    <SizeRow size="md" label="标准" />
    <SizeRow size="lg" label="宽松" />
  </section>;
}
