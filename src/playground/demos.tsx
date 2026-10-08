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
import { Checkbox } from "../components/Checkbox";
import { Alert, Message, Toast, type DismissReason } from "../components/Feedback";
import { Tabs } from "../components/Tabs";
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

function CheckboxDemo({ variant }: { variant: Variant }) {
  const [choices, setChoices] = useDemo<boolean[]>("checkbox.choices", [true, false]);
  const all = choices.every(Boolean), some = choices.some(Boolean);
  return <div className="pg-rows" data-variant={variant}>
    <Checkbox checked={all} indeterminate={some && !all} onChange={checked => setChoices([checked, checked])}>全部效果</Checkbox>
    <div className="pg-checkbox-children">
      {['淡入淡出', '弹性缩放'].map((label, i) => <Checkbox key={label} checked={choices[i]}
        onChange={checked => setChoices(prev => prev.map((value, index) => index === i ? checked : value))}>{label}</Checkbox>)}
    </div>
    {variant === "stage" && <Checkbox checked disabled onChange={() => {}} description="不可操作的状态保留清晰的选中提示">禁用选项</Checkbox>}
  </div>;
}

function FeedbackDemo({ variant }: { variant: Variant }) {
  const [alert, setAlert] = useState(true);
  const [message, setMessage] = useState(false);
  const [toast, setToast] = useState(false);
  const [last, setLast] = useState<string>("提示会在悬停或聚焦时暂停倒计时");
  const dismissed = (set: (open: boolean) => void) => (reason: DismissReason) => {
    set(false); setLast(reason === "manual" ? "手动关闭 · 放大并模糊消散" : "自动关闭 · 保持尺寸，模糊消散");
  };
  return <div className="pg-rows pg-feedback-demo" data-variant={variant}>
    <div className="pg-inline">
      <Button size="sm" onClick={() => setAlert(true)}>Alert</Button>
      <Button size="sm" onClick={() => setMessage(true)} disabled={message}>Message</Button>
      <Button size="sm" variant="primary" onClick={() => setToast(true)} disabled={toast}>Toast</Button>
    </div>
    <div className="pg-feedback-slot">
      <Alert open={alert} onDismiss={dismissed(setAlert)} title="更改已保存" tone="success">可以继续调整，预览会同步更新。</Alert>
      <Message open={message} onDismiss={dismissed(setMessage)} tone="success">预览已更新</Message>
    </div>
    <Toast open={toast} onDismiss={dismissed(setToast)} tone="success">设置已同步，可以继续创作</Toast>
    <div className="pg-meta">{last}</div>
  </div>;
}

function TabsDemo({ variant }: { variant: Variant }) {
  const [tab, setTab] = useDemo("tabs.active", "overview");
  return <div className="pg-rows pg-tabs-demo" data-variant={variant}>
    <Tabs aria-label="项目设置" value={tab} onChange={setTab} items={[
      { value: "overview", label: "概览", content: <div className="pg-tab-copy"><strong>让操作自然发生</strong><p>圆润轮廓、清晰层次，和一点恰到好处的弹性。</p><span>11 组组件 · 蓝调石墨灰</span></div> },
      { value: "motion", label: "动效", content: <div className="pg-tab-copy"><strong>从当前状态继续</strong><p>切换标签时指示条平滑跟随，内容轻轻交接。</p><span>支持方向键、Home / End</span></div> },
      { value: "details", label: "细节", content: <div className="pg-tab-copy"><strong>留一点呼吸空间</strong><p>安全留白和统一边框，让精细操作更从容。</p><span>浅色 / 深色 · 减弱动效</span></div> },
      ...(variant === "stage" ? [{ value: "disabled", label: "未开放", content: null, disabled: true }] : []),
    ]} />
  </div>;
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
  checkbox: CheckboxDemo,
  feedback: FeedbackDemo,
  tabs: TabsDemo,
};

export const hints: Record<ComponentId, string[]> = {
  slider: [
    "hover 空白轨道：仅底色变化；靠近手柄时白点放大、内外轨道鼓起，两端等量收窄",
    "拖动：两端等量收窄，中段轻微内凹后回升接上圆头；粗细不随方向变化，离开后复原",
    "拖到端点后继续拖：白色胶囊手柄横向拉长，鼓包贴合包裹，整条轨道收细；松手一起回弹",
    "点击轨道：手柄滑过去，数值同步滚动",
    "拖动左侧标签也能调值；方向键调整，Shift 加大步长",
  ],
  input: [
    "悬停数字：下划线两端延伸、转弯上行，再在顶部汇合，描出较小的圆角外框",
    "点击立即聚焦编辑，描边闭合后再平滑放大；数字位置不变，单位同步右移；失焦后缩回，移出后收回下划线",
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
    "hover：选项上下轻微鼓起，文字保持原位；点击后鼓包短暂残留，再柔和回落",
    "切换：选中底色像液体一样流过去，前沿先到，后沿跟上",
    "滑动时选中底撑满内侧高度，沿鼓包轮廓贴合，保留固定留白",
    "连续点击或反向切换：从当前状态继续，不会重新开始",
    "← → 键切换选项",
  ],
  select: [
    "打开：列表从触发器本身生长出来，而不是凭空出现",
    "hover 选项：高亮底色连续滑动，前沿快、后沿稍慢",
    "展开途中再次点击，立即反向收回",
    "↑ ↓ 移动，Enter 选择，Esc 关闭",
  ],
  checkbox: ["悬停轻轻放大，按下收缩，选中标记带回弹出现", "支持未选、选中、半选和禁用状态；Space 切换", "全部效果与子项联动，部分选中时显示短横线"],
  feedback: ["入场：从下方可调距离向上弹出，透明度逐渐增加", "点击关闭：气泡放大、模糊并消散；自动关闭只模糊淡出", "Alert 常驻；Message 在当前位置出现；Toast 浮在页面上方", "悬停或键盘聚焦暂停自动关闭；支持减弱动效"],
  tabs: ["点击或方向键切换，底部指示条连续跟随", "内容轻微位移并淡入淡出，Home / End 跳到首尾标签", "禁用项跳过，Tab 键进入当前内容面板"],
};
