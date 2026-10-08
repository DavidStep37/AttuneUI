import type { SharedFeel, SpringName, SpringToken } from "../tokens/tokens";

/**
 * Feel-parameter schema. Each component's "可调手感参数" (Handoff §5) is
 * declared here once; the playground builds its panels from this, and
 * components read resolved values through useFeel().
 */

export type NumberParam = {
  type: "number";
  key: string;
  label: string;
  group: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  default?: number;
  /** default value comes from a shared feel token */
  inherit?: keyof SharedFeel;
  hint?: string;
};

export type SpringParam = {
  type: "spring";
  key: string;
  label: string;
  group: string;
  default?: SpringToken;
  inherit?: SpringName;
  hint?: string;
};

export type ParamDef = NumberParam | SpringParam;

const n = <K extends string>(
  key: K,
  label: string,
  group: string,
  min: number,
  max: number,
  step: number,
  opts: { unit?: string; default?: number; inherit?: keyof SharedFeel; hint?: string } = {},
): NumberParam & { key: K } => ({ type: "number", key, label, group, min, max, step, ...opts });

const s = <K extends string>(key: K, label: string, group: string, inherit: SpringName, hint?: string): SpringParam & { key: K } => ({
  type: "spring",
  key,
  label,
  group,
  inherit,
  hint,
});

/** Spring with its own tuned default instead of inheriting a shared spring token. */
const sd = <K extends string>(key: K, label: string, group: string, value: SpringToken, hint?: string): SpringParam & { key: K } => ({
  type: "spring",
  key,
  label,
  group,
  default: value,
  hint,
});

export const componentSchemas = {
  slider: [
    n("thumbHoverScale", "hover 放大", "手柄", 1, 3, 0.01, { default: 2.5, unit: "×" }),
    sd("thumbSpring", "点击轨道滑动", "手柄", { visualDuration: 0.24, bounce: 0.3 }),
    n("bulgeHeight", "双层鼓包高度", "鼓包", 0, 14, 0.5, { default: 8, unit: "px", hint: "已选柱体与外轨道同步撑开" }),
    n("bulgeWidth", "影响宽度", "鼓包", 1, 8, 0.1, { default: 2, unit: "×", hint: "手柄两侧曲线的展开距离；越小越像紧凑驼峰，不随已选长度增加" }),
    n("endInset", "两端收窄", "鼓包", 0, 3, 0.1, { default: 3, unit: "px", hint: "手柄附近悬停和拖拽时，外轨道与深色填充的上下边缘各内收此距离，两端等量；空白轨道悬停仅变色" }),
    n("neckDepth", "中段内凹", "鼓包", 0, 2, 0.1, { default: 1.5, unit: "px", hint: "鼓包过渡到端点时轻微内凹，再平滑回升；0 为平直柱身" }),
    n("trail", "拖尾", "鼓包", 0, 1, 0.01, { default: 0.3 }),
    sd("follow", "拖尾响应", "鼓包", { visualDuration: 0.1, bounce: 0.3 }, "拖尾形状跟上速度变化的快慢；鼓包位置始终与手柄同步"),
    sd("recover", "复原", "鼓包", { visualDuration: 0.2, bounce: 0.2 }),
    n("edgePadding", "内外层间距", "端点", 1, 6, 0.5, { default: 2.5, unit: "px" }),
    n("edgeResistance", "极值阻力", "端点", 0, 1, 0.01, { default: 0.5 }),
    n("maxStretch", "最大拉伸", "端点", 0, 24, 1, { inherit: "edgeMaxStretch", unit: "px" }),
  ],
  input: [
    n("expand", "外框外扩", "外框", 0, 10, 0.5, { default: 4, unit: "px", hint: "描边闭合时，外框各边向外扩出的距离；数字保持居中" }),
    n("drawDuration", "描边时长", "外框", 100, 4000, 20, { default: 300, unit: "ms", hint: "悬停时从下划线画成小外框的时间，独立于全局弹簧；越小越快，最快 100ms" }),
    n("expandDuration", "放大时长", "外框", 300, 1000, 20, { default: 480, unit: "ms", hint: "聚焦后从小外框放大到编辑尺寸的时间；数字立即进入编辑" }),
    n("bgShift", "底色变化", "外框", 0, 1, 0.01, { default: 1 }),
    n("highlight", "高光强度", "外框", 0, 1, 0.01, { default: 1 }),
    n("scrubSensitivity", "拖动灵敏度", "拖动调值", 0.05, 2, 0.05, { default: 0.5, unit: "步/px" }),
  ],
  timeline: [
    n("edgePadding", "两端安全区", "布局", 4, 24, 1, { default: 10, unit: "px", hint: "0 刻度和结束刻度距离轨道边缘的留白，横条与刻度一起内移" }),
    n("pluckAmp", "拨弦幅度", "划过", 0, 10, 0.5, { default: 4, unit: "px", hint: "会乘以被动强度" }),
    s("pluckSpring", "拨弦弹簧", "划过", "pluck"),
    n("stretchThin", "拉伸变细", "拉伸", 0, 1, 0.01, { inherit: "volumeConservation" }),
    s("recover", "松手回弹", "拉伸", "soft"),
    n("pressSpread", "按压摊开", "整体拖拽", 0, 6, 0.25, { default: 2, unit: "px" }),
    n("pressDarken", "颜色加深", "整体拖拽", 0, 0.4, 0.01, { default: 0.12 }),
  ],
  button: [
    n("attract", "吸引偏移", "吸引", 0, 12, 0.5, { default: 5, unit: "px", hint: "会乘以被动强度" }),
    n("tilt", "倾斜角度", "吸引", 0, 20, 0.5, { default: 8, unit: "°", hint: "会乘以被动强度" }),
    s("hoverSpring", "跟随", "吸引", "snappy"),
    n("pressTilt", "按压倾斜", "按压", 0, 16, 0.5, { default: 6, unit: "°" }),
    n("pressScale", "按压缩放", "按压", 0.9, 1, 0.005, { default: 0.97, unit: "×" }),
    s("recover", "回弹", "按压", "soft"),
  ],
  bezier: [
    n("pointHoverScale", "控制点放大", "控制点", 1, 2, 0.01, { default: 1.35, unit: "×" }),
    n("lineThin", "连接线变细", "控制点", 0, 1, 0.01, { inherit: "volumeConservation" }),
    n("edgeResistance", "边界阻力", "控制点", 0, 1, 0.01, { inherit: "edgeResistance" }),
    s("recover", "松手回弹", "控制点", "soft"),
    s("presetSpring", "预设切换", "预设", "pop"),
  ],
  switch: [
    n("thumbHoverScale", "hover 放大", "手柄", 1, 1.5, 0.01, { default: 1.22, unit: "×" }),
    n("bulgeHeight", "鼓包高度", "手柄", 0, 10, 0.25, { default: 5, unit: "px" }),
    n("squash", "滑动形变", "手柄", 0, 1, 0.01, { default: 0.5 }),
    s("slideSpring", "滑动与吸附", "手柄", "snappy"),
    s("revealSpring", "关联区域展开", "关联区域", "pop"),
  ],
  segmented: [
    n("bulgeHeight", "悬停鼓包", "鼓包", 0, 6, 0.25, { default: 2.5, unit: "px", hint: "选项上下边缘向外轻微鼓起，文字保持原位" }),
    n("lingerDuration", "残留消退", "鼓包", 100, 1000, 20, { default: 420, unit: "ms", hint: "点击后鼓包保留当前形态，再逐渐回落的时间" }),
    s("hoverSpring", "鼓包响应", "鼓包", "soft"),
    s("headSpring", "前沿", "选中底色", "snappy"),
    s("tailSpring", "后沿", "选中底色", "soft"),
  ],
  select: [
    s("openSpring", "展开", "列表", "pop"),
    s("highlightSpring", "高亮跟随", "高亮", "snappy"),
    n("highlightStretch", "高亮拉伸", "高亮", 0, 1, 0.01, { default: 0.5 }),
  ],
  checkbox: [
    n("hoverScale", "悬停放大", "外框", 1, 1.2, 0.01, { default: 1.08, unit: "×" }),
    n("pressScale", "按压收缩", "外框", 0.8, 1, 0.01, { default: 0.92, unit: "×" }),
    s("spring", "勾选回弹", "选中", "snappy"),
  ],
  feedback: [
    n("enterOffset", "弹出位移", "入场", 0, 24, 1, { default: 8, unit: "px", hint: "从最终位置下方开始，向上弹到位；文字和气泡一起移动" }),
    s("enterSpring", "入场回弹", "入场", "pop"),
    n("duration", "自动停留", "退场", 1000, 10000, 100, { default: 3200, unit: "ms", hint: "Message / Toast 自动消失前的停留时间，悬停或键盘聚焦时暂停" }),
    n("dismissScale", "点击爆开", "退场", 1, 1.3, 0.01, { default: 1.12, unit: "×", hint: "仅手动关闭时向外放大，自动退场保持原尺寸" }),
    n("exitBlur", "消散模糊", "退场", 0, 16, 0.5, { default: 8, unit: "px" }),
    n("exitDuration", "消散时长", "退场", 100, 800, 20, { default: 240, unit: "ms" }),
  ],
  tabs: [
    s("indicatorSpring", "指示条跟随", "标签", "snappy"),
    n("contentOffset", "内容位移", "内容", 0, 16, 1, { default: 6, unit: "px" }),
    n("contentDuration", "内容过渡", "内容", 100, 600, 20, { default: 180, unit: "ms" }),
  ],
} satisfies Record<string, ParamDef[]>;

export type ComponentId = keyof typeof componentSchemas;

type Defs<C extends ComponentId> = (typeof componentSchemas)[C][number];

export type ResolvedFeel<C extends ComponentId> = {
  [D in Defs<C> as D["key"]]: D extends { type: "spring" } ? SpringToken : number;
};

export type ParamValue = number | SpringToken;
export type Overrides = Partial<Record<ComponentId, Record<string, ParamValue>>>;

export const sharedSchema: NumberParam[] = [
  n("passiveStrength", "划过反馈强度", "共享规则", 0, 1, 0.01, { default: 0.4, hint: "Button 的鼠标吸引偏移与倾斜、Timeline 的划过拨弦。越大反应越明显；0 关闭这两种反馈。" }),
  n("falloffRadius", "鼓包展开范围", "共享规则", 1, 8, 0.1, { default: 3, unit: "×", hint: "Slider 手柄两侧的鼓包宽度。越小越紧凑，越大过渡越舒展；不改变鼓包高度。" }),
  n("volumeConservation", "粗细补偿强度", "共享规则", 0, 1, 0.01, { default: 0.6, hint: "Timeline 拉长时变细、Bezier 控制点连接线变细。越大补偿越明显；Slider 和 Segmented 不使用此参数。" }),
  n("edgeResistance", "越界跟随比例", "共享规则", 0, 1, 0.01, { default: 0.35, hint: "Slider 拉过最小/最大值、Bezier 控制点越过横向边界时的弹性跟随。越大越容易拉动，越小越硬；实际值仍限制在范围内。" }),
  n("edgeMaxStretch", "端点拉伸上限", "共享规则", 0, 24, 1, { default: 8, unit: "px", hint: "仅影响 Slider 超出两端后的额外拉伸距离。越大能拉得越远；0 禁止端点拉伸。" }),
  n("deformScale", "形变总强度", "共享规则", 0, 2, 0.01, { default: 1, hint: "统一调整 Slider 鼓包、Input 外扩、Timeline 拨弦与拉伸、Button 倾斜、Bezier 控制点、Switch 形变、Segmented 鼓包、Checkbox 缩放、提示手动爆开和 Tabs 内容位移。0 关闭这些形变，操作仍可用。" }),
];

const springHints: Record<SpringName, string> = {
  follow: "Slider 拖尾对速度变化的响应。时长越短跟随越快；这里的弹性不影响拖尾，也不改变柱身粗细。",
  snappy: "Slider 点击轨道与手柄放大、Button 跟随与按压、Switch 滑动、Segmented 前沿、Select 高亮、Checkbox 勾选、Tabs 指示条。时长越大越慢，弹性越大回弹越明显。",
  soft: "Slider 离开复原、Timeline 与 Bezier 松手回弹、Button 回弹、Segmented 后沿和悬停鼓包。时长越大复原越慢，弹性越大回弹越明显。Input 绘制与放大、Segmented 点击残留使用各自的时长。",
  pop: "Select 列表展开、Switch 关联区域展开、Bezier 预设切换、Alert / Message / Toast 入场，以及参数分组展开。时长越大越慢，弹性越大回弹越明显。",
  pluck: "Timeline 鼠标划过后的拨弦回弹。时长越大余振越久，弹性越大振动越明显；幅度由拨弦幅度和划过反馈强度决定。",
};

export const springSchema: SpringParam[] = (["follow", "snappy", "soft", "pop", "pluck"] as SpringName[]).map((k) => ({
  type: "spring",
  key: k,
  label: `spring.${k}`,
  group: "共享动效",
  hint: springHints[k],
}));

export const componentMeta: Record<ComponentId, { name: string; en: string; metaphor: string }> = {
  slider: { name: "滑块", en: "Slider", metaphor: "刚性物体将软性物体撑开" },
  input: { name: "数值输入", en: "Input", metaphor: "下划线沿数字四周生长，闭合成输入框" },
  timeline: { name: "时间轴", en: "Timeline", metaphor: "被绷直的弹力带，可以继续拉长和缩短" },
  button: { name: "按钮", en: "Button", metaphor: "磁铁被吸引；受压倾斜的平衡木板" },
  bezier: { name: "贝塞尔编辑器", en: "Bezier Editor", metaphor: "控制点牵拉一根有弹性的线" },
  switch: { name: "开关", en: "Switch", metaphor: "刚性物体在软轨道内移动，被两端吸附" },
  segmented: { name: "分段控制器", en: "Segmented Control", metaphor: "液体一样从一格流向另一格的选中底色" },
  select: { name: "下拉选择", en: "Select", metaphor: "列表从入口处被撑开、生长出来" },
  checkbox: { name: "复选框", en: "Checkbox", metaphor: "轻按收缩，勾选后柔和弹回" },
  feedback: { name: "反馈提示", en: "Alert / Message / Toast", metaphor: "气泡向上弹出，点击后膨胀消散" },
  tabs: { name: "标签页", en: "Tabs", metaphor: "指示条跟随选择，内容轻盈交接" },
};
