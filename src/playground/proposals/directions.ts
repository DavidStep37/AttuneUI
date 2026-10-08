import { defaultFeelState, type FeelState } from "../../core/feel";
import { color } from "../../tokens/tokens";

export type DirectionId = "glass" | "paper" | "graphite" | "gummy" | "brutal";
type Palette = [string, string, string, string, string, string, string, string, string, string];
export type Direction = {
  id: DirectionId; number: string; name: string; en: string; title: string; subtitle: string;
  description: string; tags: string[]; material: string; motion: string; bestFor: string; tradeoff: string;
  evidence: string; sources: { label: string; url: string }[];
  light: Palette; dark: Palette; radius: number; theme: "light" | "dark"; baseline: FeelState;
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
    radius: 20, theme: "light", baseline: baseline(1.05, 0.35, 0.27, 0.2),
  },
  {
    id: "paper", number: "02", name: "纸感编辑", en: "Folio", title: "A quieter kind\nof expression.", subtitle: "把复杂交互，编排得从容。",
    description: "暖白纸面、墨色细线与编辑式排版。放大信息层级，收敛装饰，让精确操作具有安静的秩序。",
    tags: ["EDITORIAL", "WARM MINIMAL", "纸面秩序"], material: "暖纸白 / 墨绿 / 衬线标题",
    motion: "从容收敛 · 240 ms · 回弹 0.10", bestFor: "内容编辑、知识工具、长期使用的工作台", tradeoff: "衬线只用于标题；数值和控件保留清晰的无衬线字。形变克制但仍可感知。",
    evidence: "Pinterest 可见编辑式网页排版的持续收藏；Pinterest Poetcore 提供纸感与文学气质的跨领域线索。不能据此断言它是新的 UI 爆款。",
    sources: [{ label: "Pinterest · Editorial / Web Design ↗", url: "https://uk.pinterest.com/jscreativeldn/aiimi-20256/" }, report],
    light: ["#f3f0e8", "#faf8f1", "#e9e5d9", "#fffdf7", "#c8c5b7", "#2a302b", "#62675c", "#717467", "#49634b", "#dfe6d9"],
    dark: ["#20221e", "#292c25", "#1c1f1a", "#363b31", "#505848", "#eeeade", "#bebfad", "#a2a792", "#bbcf9b", "#3c4930"],
    radius: 3, theme: "light", baseline: baseline(0.7, 0.3, 0.24, 0.1),
  },
  {
    id: "graphite", number: "03", name: "精密仪表", en: "Signal", title: "Precision,\nwith a pulse.", subtitle: "安静待命，准确响应。",
    description: "石墨灰工作台、网格刻度与荧光绿状态点。把组件当作精密仪器，每一次反馈都对应明确的状态。",
    tags: ["DARK UTILITY", "INSTRUMENT", "高密度工具"], material: "石墨黑 / 信号绿 / 技术刻度",
    motion: "迅速到位 · 180 ms · 回弹 0.08", bestFor: "开发工具、数据工作台、专业动效编辑器", tradeoff: "荧光色集中在操作对象和状态；避免大面积发光干扰读数。",
    evidence: "深色工具 UI 是持续发展的成熟方向。Pinterest 仪表盘案例与 Linear 的一手改版记录支持层次、密度和导航的设计思路，未获得实时热度数据。",
    sources: [{ label: "Pinterest · Dark Dashboard ↗", url: "https://in.pinterest.com/pin/391883605091911909/" }, { label: "Linear · UI redesign ↗", url: "https://linear.app/now/how-we-redesigned-the-linear-ui" }],
    light: ["#e9edeb", "#f7faf8", "#dde5e0", "#ffffff", "#bdc9c0", "#18251d", "#506458", "#617568", "#267445", "#cee9d7"],
    dark: ["#111513", "#1a211d", "#111914", "#26322b", "#35483b", "#e6efe7", "#a6b7aa", "#8c9f91", "#c1ed83", "#30472b"],
    radius: 6, theme: "dark", baseline: baseline(0.75, 0.25, 0.18, 0.08),
  },
  {
    id: "gummy", number: "04", name: "柔软糖果", en: "Mochi", title: "A little more\nroom to play.", subtitle: "让手感，变得可见。",
    description: "奶油底色、莓果色操作点与圆润的软表面。让挤压、张力和复原更容易被感知，也更值得把玩。",
    tags: ["GIMME GUMMY", "SOFT TACTILE", "柔软形变"], material: "奶油白 / 莓果粉 / 软圆角",
    motion: "柔软回弹 · 300 ms · 回弹 0.28", bestFor: "创意工具、轻量编辑器、交互教学与原型", tradeoff: "只让容器和背景变形；文字与读数保持稳定，避免柔软材质损害可读性。",
    evidence: "Pinterest Predicts 2026 的 Gimme Gummy 指向弹性与触感，属于跨领域趋势；与已有 Claymorphism 灵感结合，转译成可交互的软表面。",
    sources: [report, { label: "Pinterest · Claymorphism UI ↗", url: "https://www.pinterest.com/pin/claymorphism-in-ui-design--1047720300820638562/" }],
    light: ["#f9efe9", "#fff9f4", "#f1e1dc", "#fffcf8", "#dbc1b8", "#503537", "#80605d", "#896b65", "#ba4e6a", "#f8dce3"],
    dark: ["#291d24", "#372630", "#291b24", "#4b3441", "#694957", "#fff0ec", "#d9b4be", "#c59aa8", "#f6a3b9", "#653a4e"],
    radius: 28, theme: "light", baseline: baseline(1.25, 0.42, 0.3, 0.28),
  },
  {
    id: "brutal", number: "05", name: "大胆构造", en: "Offset", title: "Make your\nmove.", subtitle: "有力量的边界，有弹性的回应。",
    description: "柠檬黄、大字重、明确边框和偏移阴影。用直接的视觉结构表达可操作性，让每次按压都有落点。",
    tags: ["NEOBRUTALISM", "BOLD TYPE", "明确边界"], material: "柠檬黄 / 墨黑 / 硬边投影",
    motion: "干脆有力 · 200 ms · 回弹 0.15", bestFor: "独立产品、实验性创作工具、品牌鲜明的面板", tradeoff: "强对比主要用于分区和主操作。软轨道仍保留连续形变，避免反馈变成生硬跳变。",
    evidence: "Pinterest 有持续的新粗野主义 UI 收藏，2026 年也出现了可用的仪表盘模板。它是延续并产品化的方向，不能等同于刚出现的新趋势。",
    sources: [{ label: "Pinterest · Neo-brutalism UI ↗", url: "https://www.pinterest.com/mtcdlmt/neo-brutalism-ui-design/" }, { label: "BrutAdmin · 2026 dashboard ↗", url: "https://neobrutalism.com/templates/brutadmin" }],
    light: ["#f2f0e7", "#fffef8", "#e7e5da", "#ffffff", "#272820", "#25261f", "#56574c", "#656659", "#565d0a", "#eaf589"],
    dark: ["#191b14", "#25291c", "#14180e", "#363e27", "#899563", "#f4f5df", "#c5cbae", "#adb797", "#d5ed59", "#485320"],
    radius: 0, theme: "light", baseline: baseline(0.95, 0.35, 0.2, 0.15),
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
    "fill-primary": d.id === "brutal" ? "#dfef70" : accent,
    "fill-primary-hover": d.id === "brutal" ? "#d0e44f" : `color-mix(in srgb, ${accent} 85%, ${primary})`,
    "fill-primary-contrast": d.id === "brutal" ? "#20251a" : dark ? canvas : "#ffffff",
    "focus-ring": `color-mix(in srgb, ${accent} 65%, transparent)`,
  };
  return Object.entries(c).map(([k, v]) => `--at-color-${k}:${v};`).join("") + `color-scheme:${dark ? "dark" : "light"};`;
}

export const directionCSS = directions.map((d) => {
  const sel = `:root[data-proposal="${d.id}"]`;
  return `${sel}{${vars(d, false)}--study-radius:${d.radius}px;--at-radius-sm:${Math.min(d.radius, 9)}px;--at-radius-md:${Math.min(d.radius, 12)}px;--at-radius-lg:${d.radius}px;--at-radius-control:${d.radius}px;}
${sel}[data-theme="dark"]{${vars(d, true)}}
@media(prefers-color-scheme:dark){${sel}:not([data-theme="light"]){${vars(d, true)}}}`;
}).join("\n");
