import { defaultFeelState, type FeelState } from "../../core/feel";
import { color } from "../../tokens/tokens";

export type DirectionId = "glass" | "liquid";
type Palette = [string, string, string, string, string, string, string, string, string, string];
export type Direction = {
  id: DirectionId; number: string; name: string; en: string; title: string; subtitle: string;
  description: string; tags: string[]; material: string; motion: string; bestFor: string; tradeoff: string;
  evidence: string; sources: { label: string; url: string }[]; notesDate: string;
  light: Palette; dark: Palette; radius: number; theme: "light" | "dark"; baseline: FeelState;
  /** Exact token overrides applied after the palette mapping (e.g. translucent glass surfaces). */
  tokens?: { light?: Record<string, string>; dark?: Record<string, string> };
};
const baseline = (deform: number, passive: number, time: number, bounce: number): FeelState => ({
  ...defaultFeelState,
  shared: { ...defaultFeelState.shared, deformScale: deform, passiveStrength: passive },
  springs: {
    ...defaultFeelState.springs,
    snappy: { visualDuration: time, bounce: Math.min(bounce, 0.16) },
    soft: { visualDuration: time + 0.09, bounce },
    pop: { visualDuration: time + 0.16, bounce },
  },
});
const report = { label: "Pinterest Predicts 2026 ↗", url: "https://business.pinterest.com/pdf/pinterest-predicts/2026-trend-report/" };

export const directions: Direction[] = [
  {
    id: "glass", number: "01", name: "冰蓝玻璃", en: "Glacier", title: "Clarity in motion.", subtitle: "轻盈的层次，清晰的回应。",
    description: "冰蓝底色、透光表面与柔和轮廓。用层次表达容器关系，让每一次操作都有轻盈的回应。",
    tags: ["LIQUID GLASS", "COOL BLUE", "通透层次"], material: "雾面玻璃 / 冰蓝 / 大圆角",
    motion: "轻柔跟随 · 270 ms · 回弹 0.20", bestFor: "创作工具、媒体控制、浮动调试面板", tradeoff: "玻璃只用于容器；数值区维持稳定底色。大面积模糊需关注渲染成本。",
    evidence: "Liquid Glass 有近期产品落地与设计作品集支持；冰蓝来自 Pinterest 2026 的跨领域色彩趋势。这是两者的 UI 转译，并非平台热度排名。",
    sources: [{ label: "Pinterest · Liquid Glass 灵感板 ↗", url: "https://mx.pinterest.com/robscan/liquid-glass/" }, { label: "Apple · Liquid Glass 设计发布 ↗", url: "https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/" }, report],
    light: ["#e8f1f8", "#f8fbffe0", "#e2ebf4", "#ffffff", "#bbd0e3", "#172e49", "#506881", "#5b7390", "#2467b8", "#d6e8ff"],
    dark: ["#0d1b2b", "#162d43eb", "#102438", "#24425c", "#35536b", "#edf6ff", "#b1c8dc", "#93adc5", "#88c3ff", "#254b70"],
    notesDate: "2026.10.04",
    radius: 20, theme: "light", baseline: baseline(1.05, 0.35, 0.27, 0.2),
  },
  {
    id: "liquid", number: "02", name: "液态玻璃", en: "Liquid", title: "Light, in flow.", subtitle: "光线流过，界面随之回应。",
    description: "参考 Apple Liquid Glass：控件像一层会折射的玻璃，浮在鲜明的内容之上。边缘弯折背后的画面，高光跟随指针移动，按压时从内部亮起。",
    tags: ["APPLE LIQUID GLASS", "LENSING", "SPECULAR", "胶囊与同心圆角"], material: "透明玻璃 / 边缘折射 / 镜面高光 / 胶囊",
    motion: "流体回弹 · 300 ms · 回弹 0.24", bestFor: "浮动控制层、媒体与创作工具、需要突出内容本身的界面",
    tradeoff: "折射只用于边缘，读数区保留足够的磨砂底色以保证对比度。边缘折射依赖 Chromium 的 backdrop-filter SVG 滤镜，其他浏览器退化为磨砂玻璃；尊重“减少透明度”。",
    evidence: "Apple 在 2025 年 6 月发布 Liquid Glass，并在 WWDC25 和人机界面指南中说明其特征：实时折射背后内容、镜面高光随光线与运动变化、根据内容自适应明暗，以及胶囊与同心圆角的形状体系。这里是面向 Web 工具的转译，不是 Apple 材质的复刻。",
    sources: [
      { label: "Apple · Liquid Glass 设计发布 ↗", url: "https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/" },
      { label: "WWDC25 · Meet Liquid Glass ↗", url: "https://developer.apple.com/videos/play/wwdc2025/219/" },
      { label: "Apple HIG · Materials ↗", url: "https://developer.apple.com/design/human-interface-guidelines/materials" },
    ],
    notesDate: "2026.10.08",
    light: ["#e8ecf4", "rgba(255,255,255,0.48)", "rgba(255,255,255,0.34)", "rgba(255,255,255,0.72)", "rgba(255,255,255,0.7)", "#0b0f19", "#353c4c", "#545c6d", "#0a7cff", "rgba(10,124,255,0.14)"],
    dark: ["#05070d", "rgba(36,40,52,0.46)", "rgba(255,255,255,0.09)", "rgba(255,255,255,0.16)", "rgba(255,255,255,0.2)", "#f5f7fb", "#c9cfdb", "#a2aaba", "#3b9bff", "rgba(59,155,255,0.24)"],
    radius: 26, theme: "light", baseline: baseline(1.1, 0.4, 0.3, 0.24),
    tokens: {
      light: { "slider-fill": "#0a7cff", "surface-overlay": "rgba(214,222,240,0.32)", "border-subtle": "rgba(255,255,255,0.55)", "border-strong": "rgba(11,15,25,0.28)", "shadow-color": "rgba(24,32,72,0.14)", "shadow-color-soft": "rgba(24,32,72,0.08)", "highlight-line": "rgba(255,255,255,0.95)" },
      dark: { "slider-fill": "#3b9bff", "fill-primary": "#1f7ae0", "fill-primary-hover": "#2a86ee", "fill-primary-contrast": "#ffffff", "accent-contrast": "#ffffff", "surface-overlay": "rgba(4,6,12,0.42)", "border-subtle": "rgba(255,255,255,0.14)", "border-strong": "rgba(255,255,255,0.4)", "shadow-color": "rgba(0,0,0,0.45)", "shadow-color-soft": "rgba(0,0,0,0.3)", "highlight-line": "rgba(255,255,255,0.28)" },
    },
  },
];

export function getDirection(id: string | null) { return directions.find((d) => d.id === id) ?? directions[0]; }

function vars(d: Direction, dark: boolean) {
  const [canvas, panel, sunken, raised, border, primary, secondary, tertiary, accent, subtle] = dark ? d.dark : d.light;
  const c = { ...color[dark ? "dark" : "light"],
    "bg-canvas": canvas, "surface-panel": panel, "surface-sunken": sunken, "surface-raised": raised,
    "surface-hover": `color-mix(in srgb, ${sunken} 78%, ${accent})`,
    "surface-overlay": dark ? "rgba(8,12,16,.8)" : "rgba(236,238,235,.8)",
    "border-subtle": `color-mix(in srgb, ${border} 65%, transparent)`, "border-default": border, "border-strong": secondary,
    "text-primary": primary, "text-secondary": secondary, "text-tertiary": tertiary,
    "accent-default": accent, "accent-hover": `color-mix(in srgb, ${accent} 85%, ${primary})`, "accent-subtle": subtle,
    "accent-contrast": dark ? canvas : "#ffffff", "control-thumb": dark ? primary : raised,
    "slider-fill": dark ? `color-mix(in srgb, ${accent} 60%, ${canvas})` : `color-mix(in srgb, ${accent} 40%, ${primary})`,
    "slider-thumb": "#ffffff",
    "fill-primary": accent,
    "fill-primary-hover": `color-mix(in srgb, ${accent} 85%, ${primary})`,
    "fill-primary-contrast": dark ? canvas : "#ffffff",
    "focus-ring": `color-mix(in srgb, ${accent} 65%, transparent)`,
    ...(dark ? d.tokens?.dark : d.tokens?.light),
  };
  return Object.entries(c).map(([k, v]) => `--at-color-${k}:${v};`).join("") + `color-scheme:${dark ? "dark" : "light"};`;
}

export const directionCSS = directions.map((d) => {
  const sel = `:root[data-proposal="${d.id}"]`;
  return `${sel}{${vars(d, false)}--study-radius:${d.radius}px;--at-radius-sm:${Math.min(d.radius, 9)}px;--at-radius-md:${Math.min(d.radius, 12)}px;--at-radius-lg:${d.radius}px;--at-radius-control:${d.radius}px;}
${sel}[data-theme="dark"]{${vars(d, true)}}
@media(prefers-color-scheme:dark){${sel}:not([data-theme="light"]){${vars(d, true)}}}`;
}).join("\n");
