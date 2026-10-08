# Attune UI · 五个样式提案

调研与实现日期：2026-10-04。

## 调研边界

本次使用 Pinterest 可公开索引的灵感板、Pinterest 官方 2026 趋势报告、X 可索引设计讨论，以及品牌/产品的一手设计资料。无法取得 Pinterest 收藏增长或 X 全平台互动排名，所以这里是五个有来源的设计方向，**不是实时热度前五名**。灵感板抓取时间不等于作品发布时间。

Pinterest Predicts 是跨领域预测，报告基于 2023 年 9 月至 2025 年 8 月的搜索数据；Cool Blue、Poetcore、Gimme Gummy 不能直接当作 UI 热度数据。本项目将其中的色彩、编辑气质和弹性触感转译成工具 UI。

## 五个方向

| 提案 | 页面 | 视觉变化 | 手感基线 | 适用场景 |
| --- | --- | --- | --- | --- |
| Glacier / 冰蓝玻璃 | `/?proposal=glass` | 冰蓝、透光容器、20px 外圆角 | snappy 270ms / soft bounce .20 | 创作工具、浮动控制面板 |
| Folio / 纸感编辑 | `/?proposal=paper` | 暖纸白、墨绿、细线、衬线标题、3px 外圆角 | 240ms / .10 | 编辑器、知识工作台 |
| Signal / 精密仪表 | `/?proposal=graphite` | 默认深色、网格刻度、信号绿、6px 外圆角 | 180ms / .08 | 开发工具、专业控制台 |
| Mochi / 柔软糖果 | `/?proposal=gummy` | 奶油/莓果色、软表面、28px 外圆角 | 300ms / .28 | 创意工具、交互原型 |
| Offset / 大胆构造 | `/?proposal=brutal` | 柠檬黄、粗轮廓、硬投影、直角结构 | 200ms / .15 | 独立产品、实验性工作台 |

保留 Slider 鼓包及边界阻力、Input 精确输入及标签拖动、Timeline 张力、Button 吸引与按压、Bezier 控制点牵拉、Switch 联动展开、Segmented 连续位移、Select 从入口展开。改变视觉表面和反馈幅度，不改变数值语义或命中区域。预览中的三个对象可以调整空间、时长、入场顺序和交错。

## 参考及证据强度

- **Glacier：近期趋势支持较强。** [Pinterest Liquid Glass 灵感板](https://mx.pinterest.com/robscan/liquid-glass/)、[Apple Liquid Glass 发布](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)、[Pinterest Predicts 2026](https://business.pinterest.com/pdf/pinterest-predicts/2026-trend-report/) 的 Cool Blue。采用半透明和层次，不宣称实现真实折射。
- **Folio：持续风格 + 跨领域转译。** [Pinterest Editorial / Web Design](https://uk.pinterest.com/jscreativeldn/aiimi-20256/) 与报告中的 Poetcore。衬线仅用于展示标题，控件和数字继续使用适合阅读的字体。
- **Signal：成熟方向。** [Pinterest 深色仪表盘](https://in.pinterest.com/pin/391883605091911909/)、[Linear 一手 UI 改版记录](https://linear.app/now/how-we-redesigned-the-linear-ui)。借鉴信息密度与层次，不将深色模式包装成 2026 新趋势。
- **Mochi：跨领域转译。** 官方报告中的 Gimme Gummy，以及 [Pinterest Claymorphism UI](https://www.pinterest.com/pin/claymorphism-in-ui-design--1047720300820638562/)。强调软轮廓与回弹，避免夸张材质影响文字。
- **Offset：持续风格 + 近期产品案例。** [Pinterest Neo-brutalism UI](https://www.pinterest.com/mtcdlmt/neo-brutalism-ui-design/) 和 [2026 年 BrutAdmin 仪表盘模板](https://neobrutalism.com/templates/brutadmin)。增加清晰结构，但保留轨道的连续形变。
- **X 的辅助观察。** [Marcelo Design X 的动效概念讨论（2026-01-12）](https://x.com/MarceloDesignX/status/2010827847435157833) 关注动效与深度的意义。这是单个案例，未用作趋势排名依据。

## 隔离和实现

- `/` 和 `/#sample` 保留原版。顶部增加提案链接。
- 提案样式全部限定在 `data-proposal` 或 `study-*` 类名下；组件源码复用。
- 原版继续使用 `attune-playground-v1`，五套提案分别使用 `attune-proposal-{id}-v1`，重置回各自基线。
- 每套支持浅色、深色、系统主题；同一浏览器会话中比较提案时，组件演示数值共享，手感参数独立。
- 点击组件标题可以打开现有调参面板；“导出方案配置”下载包含方案标识、主题、当前手感和来源的 JSON。
- 样例增加可选的嵌入式面板；原版默认仍为浮动面板。样例补充减弱动效支持与卸载时动画清理。

## 本地验收

运行 `npm run build` 进行类型检查和生产构建。启动 Vite 后，运行 `node scripts/check-proposals.mjs` 进行浏览器检查，截图默认输出到忽略目录 `.backup/proposal-review`。

脚本使用仓库已有的 Puppeteer。支持 `CHROME_PATH`、`ATTUNE_URL` 和 `ATTUNE_SHOTS` 环境变量。检查五套方案的切换、数值键盘调节、轨道点击、调参弹窗、下拉键盘操作、明暗主题、减弱动效状态、390px 窄屏、历史导航、刷新恢复和原版配置隔离。

本次验证：类型检查、生产构建、上述五套方案浏览器检查、方案独立重置和 JSON 下载均通过，未捕获到浏览器运行时异常。已人工检查五套默认外观及部分深色/窄屏截图。这是桌面 Chrome 的功能与布局验收，不代表多浏览器和真实设备的完整性能验收。
