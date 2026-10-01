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

export const componentSchemas = {
  slider: [
    n("thumbHoverScale", "hover 放大", "手柄", 1, 1.5, 0.01, { default: 1.15, unit: "×" }),
    s("thumbSpring", "点击轨道滑动", "手柄", "snappy"),
    n("bulgeHeight", "鼓包高度", "鼓包", 0, 14, 0.5, { default: 6, unit: "px", hint: "撑开后比常态多出的高度" }),
    n("bulgeWidth", "影响宽度", "鼓包", 1, 8, 0.1, { inherit: "falloffRadius", unit: "×", hint: "手柄宽度的倍数" }),
    n("endShrink", "两端收缩", "鼓包", 0, 1, 0.01, { inherit: "volumeConservation", hint: "体积守恒：远端变矮的程度" }),
    n("trail", "拖尾", "鼓包", 0, 1, 0.01, { default: 0.2 }),
    s("follow", "跟随", "鼓包", "follow"),
    s("recover", "复原", "鼓包", "soft"),
    n("edgePadding", "端点留白", "端点", 0, 6, 0.5, { default: 3, unit: "px" }),
    n("edgeResistance", "极值阻力", "端点", 0, 1, 0.01, { inherit: "edgeResistance" }),
    n("maxStretch", "最大拉伸", "端点", 0, 24, 1, { inherit: "edgeMaxStretch", unit: "px" }),
  ],
  input: [
    n("expand", "撑开幅度", "外框", 0, 10, 0.5, { default: 4, unit: "px" }),
    s("spring", "撑开与回弹", "外框", "soft"),
    n("bgShift", "底色变化", "外框", 0, 1, 0.01, { default: 1 }),
    n("highlight", "高光强度", "外框", 0, 1, 0.01, { default: 1 }),
    n("scrubSensitivity", "拖动灵敏度", "拖动调值", 0.05, 2, 0.05, { default: 0.5, unit: "步/px" }),
  ],
  timeline: [
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
    n("thumbHoverScale", "hover 放大", "手柄", 1, 1.4, 0.01, { default: 1.1, unit: "×" }),
    n("bulgeHeight", "鼓包高度", "手柄", 0, 8, 0.25, { default: 3, unit: "px" }),
    n("squash", "滑动形变", "手柄", 0, 1, 0.01, { default: 0.3 }),
    s("slideSpring", "滑动与吸附", "手柄", "snappy"),
    s("revealSpring", "关联区域展开", "关联区域", "pop"),
  ],
  segmented: [
    s("headSpring", "前沿", "选中底色", "snappy"),
    s("tailSpring", "后沿", "选中底色", "soft"),
    n("neck", "细颈程度", "选中底色", 0, 1, 0.01, { inherit: "volumeConservation" }),
  ],
  select: [
    s("openSpring", "展开", "列表", "pop"),
    s("highlightSpring", "高亮跟随", "高亮", "snappy"),
    n("highlightStretch", "高亮拉伸", "高亮", 0, 1, 0.01, { default: 0.5 }),
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
  n("passiveStrength", "被动强度", "共享规则", 0, 1, 0.01, { default: 0.4, hint: "规则 7：划过、进入等被动反馈统一乘以此系数" }),
  n("falloffRadius", "衰减范围", "共享规则", 1, 8, 0.1, { default: 3, unit: "×", hint: "规则 2：局部作用随距离衰减" }),
  n("volumeConservation", "体积守恒", "共享规则", 0, 1, 0.01, { default: 0.6, hint: "规则 1：0 为不守恒，1 为完全守恒" }),
  n("edgeResistance", "边界阻力", "共享规则", 0, 1, 0.01, { default: 0.35, hint: "规则 3：超出距离的跟随比例" }),
  n("edgeMaxStretch", "最大拉伸", "共享规则", 0, 24, 1, { default: 8, unit: "px" }),
  n("deformScale", "形变总强度", "共享规则", 0, 2, 0.01, { default: 1, hint: "全部形变的总开关" }),
];

export const springSchema: SpringParam[] = (["follow", "snappy", "soft", "pop", "pluck"] as SpringName[]).map((k) => ({
  type: "spring",
  key: k,
  label: `spring.${k}`,
  group: "共享动效",
}));

export const componentMeta: Record<ComponentId, { name: string; en: string; metaphor: string }> = {
  slider: { name: "滑块", en: "Slider", metaphor: "刚性物体将软性物体撑开" },
  input: { name: "数值输入", en: "Input", metaphor: "袋口被撑开；被吹开的气泡" },
  timeline: { name: "时间轴", en: "Timeline", metaphor: "被绷直的弹力带，可以继续拉长和缩短" },
  button: { name: "按钮", en: "Button", metaphor: "磁铁被吸引；受压倾斜的平衡木板" },
  bezier: { name: "贝塞尔编辑器", en: "Bezier Editor", metaphor: "控制点牵拉一根有弹性的线" },
  switch: { name: "开关", en: "Switch", metaphor: "刚性物体在软轨道内移动，被两端吸附" },
  segmented: { name: "分段控制器", en: "Segmented Control", metaphor: "液体一样从一格流向另一格的选中底色" },
  select: { name: "下拉选择", en: "Select", metaphor: "列表从入口处被撑开、生长出来" },
};
