import { useState, type ReactNode } from "react";
import { BezierEditor, type Bezier } from "../components/BezierEditor";
import { Button } from "../components/Button";
import { NumberField, Row, SliderField } from "../components/Panel";
import { Segmented } from "../components/Segmented";
import { Select } from "../components/Select";
import { Slider } from "../components/Slider";
import { SwitchField } from "../components/Switch";
import { Timeline, type TimelineItem } from "../components/Timeline";
import { ValueRoll } from "../components/ValueRoll";
import type { ComponentId } from "../core/schema";
import { IconCopy, IconMinus, IconPlay, IconPlus, IconReset } from "./icons";
import { useDemo } from "./store";

export type Variant = "card" | "stage";

function SliderDemo({ variant }: { variant: Variant }) {
  const [d, setD] = useDemo("slider.duration", 320);
  const [o, setO] = useDemo("slider.opacity", 60);
  const [s, setS] = useDemo("slider.scale", 1);
  const [bare, setBare] = useDemo("slider.bare", 0.35);
  return (
    <div className="pg-rows" data-variant={variant}>
      <SliderField label="时长" value={d} onChange={setD} min={0} max={1000} step={10} unit="ms" />
      <SliderField label="不透明度" value={o} onChange={setO} min={0} max={100} step={1} unit="%" />
      {variant === "stage" && (
        <>
          <SliderField label="起始缩放" value={s} onChange={setS} min={0.5} max={1.5} step={0.01} unit="×" />
          <div className="pg-stage-caption">单独使用</div>
          <Slider value={bare} onChange={setBare} min={0} max={1} step={0.01} aria-label="单独的滑块" />
        </>
      )}
    </div>
  );
}

function InputDemo({ variant }: { variant: Variant }) {
  const [a, setA] = useDemo("input.duration", 240);
  const [b, setB] = useDemo("input.delay", 80);
  const [c, setC] = useDemo("input.scale", 1);
  const [e, setE] = useDemo("input.distance", 24);
  return (
    <div className="pg-rows pg-rows-narrow" data-variant={variant}>
      <NumberField label="时长" value={a} onChange={setA} min={0} max={5000} step={10} unit="ms" />
      <NumberField label="延迟" value={b} onChange={setB} min={0} max={5000} step={10} unit="ms" />
      <NumberField label="缩放" value={c} onChange={setC} min={0} max={4} step={0.01} unit="×" />
      {variant === "stage" && <NumberField label="位移距离" value={e} onChange={setE} min={-200} max={200} step={1} unit="px" />}
    </div>
  );
}

const defaultItems: TimelineItem[] = [
  { id: "a", label: "标题", delay: 0, duration: 320 },
  { id: "b", label: "副标题", delay: 80, duration: 320 },
  { id: "c", label: "卡片", delay: 160, duration: 400 },
  { id: "d", label: "按钮", delay: 320, duration: 240 },
];

function TimelineDemo({ variant }: { variant: Variant }) {
  const [items, setItems] = useDemo<TimelineItem[]>("timeline.items", defaultItems);
  const shown = variant === "card" ? items.slice(0, 4) : items;
  return (
    <div className="pg-rows pg-rows-wide" data-variant={variant}>
      <Timeline
        aria-label="时间轴示例"
        items={shown}
        rowHeight={variant === "stage" ? 32 : 26}
        labelWidth={variant === "stage" ? 56 : 48}
        onChange={(id, n) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...n } : it)))}
      />
      {variant === "stage" && (
        <div className="pg-inline">
          <Button size="sm" icon={<IconReset />} onClick={() => setItems(defaultItems)}>
            重置条块
          </Button>
        </div>
      )}
    </div>
  );
}

function ButtonDemo({ variant }: { variant: Variant }) {
  const [last, setLast] = useState<string>("—");
  const [count, setCount] = useDemo("button.count", 0);
  const hit = (name: string) => {
    setLast(name);
    setCount((c) => c + 1);
  };
  return (
    <div className="pg-col" data-variant={variant}>
      <div className="pg-inline">
        <Button variant="primary" icon={<IconPlay />} onClick={() => hit("播放")}>
          播放
        </Button>
        <Button icon={<IconReset />} onClick={() => hit("重置")}>
          重置
        </Button>
        <Button icon={<IconCopy />} onClick={() => hit("复制")}>
          复制
        </Button>
      </div>
      {variant === "stage" && (
        <div className="pg-inline">
          <Button variant="ghost" onClick={() => hit("取消")}>
            取消
          </Button>
          <Button size="sm" onClick={() => hit("小按钮")}>
            小按钮
          </Button>
          <Button iconOnly aria-label="减少" icon={<IconMinus />} onClick={() => hit("减少")} />
          <Button iconOnly aria-label="增加" icon={<IconPlus />} onClick={() => hit("增加")} />
        </div>
      )}
      <div className="pg-meta">
        最近点击 <b>{last}</b> · 次数 <ValueRoll value={count} text={String(count)} className="pg-meta-num" />
      </div>
    </div>
  );
}

function BezierDemo({ variant }: { variant: Variant }) {
  const [v, setV] = useDemo<Bezier>("bezier.value", [0.2, 0, 0, 1]);
  return variant === "card" ? (
    <BezierEditor value={v} onChange={setV} size={124} showInputs={false} showPresets={false} showTrack={false} />
  ) : (
    <div className="pg-bezier-stage">
      <BezierEditor value={v} onChange={setV} size={240} />
    </div>
  );
}

function SwitchDemo({ variant }: { variant: Variant }) {
  const [spring, setSpring] = useDemo("switch.spring", true);
  const [auto, setAuto] = useDemo("switch.auto", false);
  const [k, setK] = useDemo("switch.stiffness", 320);
  const [c, setC] = useDemo("switch.damping", 26);
  const [blur, setBlur] = useDemo("switch.blur", false);
  const [blurPx, setBlurPx] = useDemo("switch.blurPx", 6);
  return (
    <div className="pg-rows" data-variant={variant}>
      <SwitchField label="弹簧模式" checked={spring} onChange={setSpring}>
        <SliderField label="刚度" value={k} onChange={setK} min={50} max={800} step={10} />
        <SliderField label="阻尼" value={c} onChange={setC} min={5} max={60} step={1} />
      </SwitchField>
      <SwitchField label="自动重播" checked={auto} onChange={setAuto} />
      {variant === "stage" && (
        <SwitchField label="模糊渐入" checked={blur} onChange={setBlur}>
          <SliderField label="起始模糊" value={blurPx} onChange={setBlurPx} min={0} max={20} step={0.5} unit="px" />
        </SwitchField>
      )}
    </div>
  );
}

function SegmentedDemo({ variant }: { variant: Variant }) {
  const [a, setA] = useDemo<"bezier" | "spring">("seg.type", "bezier");
  const [b, setB] = useDemo<"row" | "col" | "diag">("seg.order", "row");
  const [c, setC] = useDemo<"xs" | "s" | "m" | "l">("seg.size", "m");
  return (
    <div className="pg-rows" data-variant={variant}>
      <Row label="缓动类型">
        <Segmented
          aria-label="缓动类型"
          value={a}
          onChange={setA}
          options={[
            { value: "bezier", label: "贝塞尔" },
            { value: "spring", label: "弹簧" },
          ]}
        />
      </Row>
      <Row label="出现顺序">
        <Segmented
          aria-label="出现顺序"
          value={b}
          onChange={setB}
          options={[
            { value: "row", label: "按行" },
            { value: "col", label: "按列" },
            { value: "diag", label: "对角线" },
          ]}
        />
      </Row>
      {variant === "stage" && (
        <Row label="密度">
          <Segmented
            aria-label="密度"
            fullWidth
            value={c}
            onChange={setC}
            options={[
              { value: "xs", label: "极紧凑" },
              { value: "s", label: "紧凑" },
              { value: "m", label: "标准" },
              { value: "l", label: "宽松" },
            ]}
          />
        </Row>
      )}
    </div>
  );
}

const orderOptions = [
  { value: "row", label: "按行", hint: "1→6" },
  { value: "col", label: "按列", hint: "↓ 再 →" },
  { value: "diag", label: "对角线", hint: "↘" },
  { value: "reverse", label: "倒序", hint: "6→1" },
  { value: "center", label: "从中心", hint: "◎" },
];
const easeOptions = [
  { value: "standard", label: "Attune standard" },
  { value: "out", label: "Attune out" },
  { value: "ease-in-out", label: "ease-in-out" },
  { value: "linear", label: "linear" },
];

function SelectDemo({ variant }: { variant: Variant }) {
  const [a, setA] = useDemo("select.order", "row");
  const [b, setB] = useDemo("select.ease", "standard");
  return (
    <div className="pg-rows" data-variant={variant}>
      <Row label="出现顺序">
        <Select aria-label="出现顺序" value={a} onChange={setA} options={orderOptions} width={variant === "stage" ? 180 : 140} listWidth={variant === "stage" ? 180 : 150} />
      </Row>
      <Row label="缓动">
        <Select aria-label="缓动" value={b} onChange={setB} options={easeOptions} width={variant === "stage" ? 180 : 140} listWidth={170} />
      </Row>
    </div>
  );
}

export const demos: Record<ComponentId, (p: { variant: Variant }) => ReactNode> = {
  slider: SliderDemo,
  input: InputDemo,
  timeline: TimelineDemo,
  button: ButtonDemo,
  bezier: BezierDemo,
  switch: SwitchDemo,
  segmented: SegmentedDemo,
  select: SelectDemo,
};

export const hints: Record<ComponentId, string[]> = {
  slider: [
    "hover 手柄：轨道被撑开，向两侧自然过渡，两端略微变矮",
    "拖动：鼓包随手柄移动，原位置逐渐复原；停下后只要指针还在手柄上，鼓包就保留",
    "拖到端点后继续拖：手柄和轨道一起向该方向被拉长，四周留白保持一致",
    "点击轨道：手柄滑过去，数值同步滚动",
    "拖动左侧标签也能调值；方向键调整，Shift 加大步长",
  ],
  input: [
    "点击数字：外框像泡泡一样被吹开，带轻微回弹，数字本身不动",
    "拖动左侧标签调整数值（Shift ×10，Alt ×0.1）",
    "聚焦后 ↑ ↓ 按步长调整，Shift 加大步长",
    "Enter 确认，Esc 取消；数值变大向上滚，变小向下滚",
  ],
  timeline: [
    "指针划过条块：像拨动琴弦一样轻微抖动；空轨道上不会抖",
    "拖动端点拉长：中间段变细；缩短：中间段变粗；松手回弹",
    "拖动整个条块：像面团被按下去一样摊开，颜色加深",
    "聚焦后 ← → 移动，Alt + ← → 调整时长",
  ],
  button: [
    "指针进入按钮：按钮被轻轻吸向指针，并向指针一侧倾斜",
    "按下：被按的一侧下压，另一侧翘起",
    "命中区域随按钮一起偏移，所见即所得",
    "成排按钮只有指针所在的那个响应",
  ],
  bezier: [
    "拖动控制点：曲线实时变化，连接线越拉越细",
    "横向拖出 0–1 边界：用阻力表达边界，松手后回到边界内",
    "切换预设：曲线从当前形态连续过渡，可以被打断",
    "聚焦控制点后用方向键微调，Shift 加大步长",
  ],
  switch: [
    "hover：手柄略微放大，轻微撑开所在位置的轨道",
    "切换：手柄滑向另一端，经过处被撑开，到达端点时被吸附",
    "开启后，关联的设置区域连续展开；关闭时更快收起",
  ],
  segmented: [
    "切换：选中底色像液体一样流过去，前沿先到，后沿跟上",
    "距离越远，中间的细颈越明显，到达后收拢",
    "连续点击或反向切换：从当前状态继续，不会重新开始",
    "← → 键切换选项",
  ],
  select: [
    "打开：列表从触发器本身生长出来，而不是凭空出现",
    "hover 选项：高亮底色连续滑动，前沿快、后沿稍慢",
    "展开途中再次点击，立即反向收回",
    "↑ ↓ 移动，Enter 选择，Esc 关闭",
  ],
};
