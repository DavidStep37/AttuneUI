# Attune UI 首发范围与展示站准备

2026-10-09。依据当前仓库实现、Handoff-20261008 和本轮目标交流。这里是建议与准备成果，不把未确认的产品方向写成永久决策。

## 建议先发布什么

**先做“有手感的 React 工具组件集”的公开预览，再逐步成为完整的悬浮调参工具。** 目前已有足够的交互辨识度，没必要等通用 UI 库的组件数量齐全。公开预览也应先过下面的接入、许可证和可用性门槛；现在不是已经可宣称稳定的 SDK。

一句话定位草案：**为创作工具与悬浮调试面板而做的、有动感的 React 组件。**

第一目标用户是需要给动画、Canvas、3D、设计工具加参数 UI 的 React 开发者。首个成果应是：用户能看懂、摸到交互，复制源码，在自己的页面挂出一个能驱动实际状态的面板。

### 当前组件清单与首发角色

“可首发预览”指已有受控 API 和相应回归基础，不等于完整浏览器、触屏或读屏器认证。

| 组件 / 模块 | 当前证据 | 建议首发角色 | 尚需补齐的发布工作 |
| --- | --- | --- | --- |
| Slider | 受控值、拖动/键盘、范围约束、连续形变、三档尺寸 | 核心主推 | API 文档、极值/禁用/步长示例、触屏验收 |
| NumberInput | 拖动调值、键盘编辑、单位/数字稳定、描边顺序回归 | 核心主推 | 数值格式和异常输入契约，明确不是 TextInput |
| Button | primary/secondary/ghost、原生按钮语义、可打断反馈 | 核心主推 | loading 用法、图标按钮命名、禁用示例 |
| Switch | 受控、关联区域展开、键盘和三档占位 | 核心主推 | 文档与说明区命名 |
| Segmented | 连续切换、radiogroup、方向键 | 核心主推 | 增补选项禁用、Home/End 等完整键盘约定 |
| Select | 列表 portal、键盘选择、方向与尺寸适配 | 核心主推，先限定短列表 | 长列表/窄视口碰撞、typeahead、读屏器语义审计 |
| Checkbox | 原生 input、半选、禁用、Space | 配套公开 | 表单关联、标签/说明文档 |
| Tabs | 单一 Tab 焦点、方向键/Home/End、禁用项 | 配套公开 | 多实例语义与读屏器验收 |
| Alert / Message / Toast | 受控反馈、自动/手动退场、悬停/聚焦暂停 | 配套公开，注明单条能力 | Toast 队列/堆叠属于后续能力，不能提前宣传 |
| BezierEditor | 拖动、键盘、曲线预设与范围处理 | Experimental，作为特色展示 | 二维控制点读屏语义、真实触屏、复杂边界 |
| Timeline | 移动/伸缩、固定/自动范围、关联样例 | Experimental，作为特色展示 | 多轨编辑契约与数据模型、移动操作、键盘说明 |
| Panel / PanelGroup / Row / Fields | 已有浮动拖拽、折叠、分组与参数组合 | 首发主场景，和核心控件一起交付 | 拖出视口后的找回、窗口 resize 约束、位置持久化、键盘可替代操作 |
| AttuneRoot（本轮新增） | 局部 tokens、主题、材质、portal 同步、系统偏好 | 安装入口，预览 API | 更多宿主 CSS 环境、SSR 与多框架验证 |

建议正式介绍以 **6 个核心控件 + 3 组配套 + 2 个实验组件** 表达，Panel 是组合入口。避免宣传“11 个生产级组件”或凑组件数量。

## 缺少哪些必要组件

顺序按“网页外挂调参面板能完成什么”排序。

| 优先级 | 缺口 | 具体使用场景 | 最小范围 | 是否阻塞第一次展示 |
| --- | --- | --- | --- | --- |
| P0 | TextInput / TextField | 名称、预设搜索、字符串参数 | 标签、描述、错误、disabled/readOnly、原生文本输入与 IME | 不阻塞限定数值面板预览；阻塞通用参数编辑承诺 |
| P0 | Tooltip | 紧凑面板解释图标、弹性、时间单位 | hover + 键盘 focus、延迟、Escape、边缘避让；不能只依赖 title | 可先让说明常显，但正式面板应补 |
| P0 | Popover 基础层 | 颜色、曲线、更多参数、帮助小卡 | 对齐/碰撞、portal、外部点击、Escape、焦点恢复 | 不阻塞现有短 Select；阻塞可复用浮层能力 |
| P1 | ColorInput / ColorPicker | 背景、填充、透明度调试 | 先做色块 + HEX/RGBA + alpha，再扩二维色盘 | 进入视觉调参场景前补 |
| P1 | Vector2 / Vector3 / RangeField | 位移、缩放、三维坐标、范围 | 基于 NumberInput 的组合，锁定比例/重置是后续 | 可复用组合完成，不急于造新底层组件 |
| P1 | Dialog | 导入/导出配置、复杂预设编辑 | 模态语义、焦点约束/恢复、Escape | 第一版可用常显代码区规避 |
| P1 | Toast 管理器 | 多次保存、异步反馈 | 队列、堆叠、取消、去重与计时 | 当前明确单条即可 |
| P1 | Loading / Empty / Error | 参数加载、无可用项目、保存失败 | 状态说明、重试与忙碌语义 | 有异步功能时补，不先做假 loading |
| P2 | Command / Presets | 快速查找参数、切换工作流 | 搜索、键盘导航、预设状态 | 不阻塞 |
| P2 | Resizable / Docking | 长期驻留的工具面板 | 伸缩、停靠、最小化、位置找回 | 先把基础拖拽与视口约束做好 |

RadioGroup 可暂由 Segmented 覆盖互斥短选项；复杂 DropdownMenu、DatePicker、DataTable、分页、树形、导航菜单均不应占首发资源。Textarea 等到多行文本确有需求再加。

### 比加组件更紧迫的四件事

1. **让别人能接进去。** 不依赖 Playground 的存储、全局 CSS 和全局主题；复制依赖闭包，给一个真实 consumer 例子。本轮已提供初步入口与验证。
2. **补足文档与契约。** 明确 props、受控状态、onChange / onChangeEnd、size、disabled、键盘操作、feel 覆盖关系；说明实验能力。
3. **完成发布门槛。** LICENSE、版本标签、CHANGELOG、支持环境、可复现构建、最小 CI。当前无 LICENSE，不自动替作者作出授权决定。
4. **审核真实的外挂场景。** 页面滚动、弹出层碰撞、拖出屏幕、宿主 CSS、多个局部主题、减少动效、不同背景下可读性。

## 基础视觉需不需要调整

**需要增加材质层，原始配色和动作语言可以继续使用。** 本轮没有采用新的提案色板。

层级建议：页面内容 → 有轻阴影与高光边界的磨砂面板 → 比面板更轻的控件底色 → 清晰的石墨灰选中填充/白色手柄 → 稳定的文字与数值。透明度是层次工具，不能同时稀释所有信息。

新增的 AttuneRoot 提供 solid / frosted、blur、opacity、panelRadius、colors。选择 frosted 才开启半透明和 blur，默认 solid；继续尊重系统减少透明度。原版、glass、liquid 保留独立存储和入口，不把两套提案混入主展示风格。

重要边界：本轮支持的是 **HTML 表面背景模糊 + 透明 SVG 轨道**。没有把 backdrop-filter 套在每条变形路径上；形变轮廓和命中区域仍按原来规则。统一控件圆角尚未解决所有 SVG 几何，因此仅开放面板圆角，不能把 CSS radius 改完就声称全库可自定义。

建议对比的三个场景：白底文档、细网格/设计画布、高信息密度的彩色内容。展示站已放置文字和斜条背景用来判断模糊是否真正可见；正式验收还需加入真实宿主。

## 展示站已准备的内容

本地入口：`http://localhost:5188/showcase.html`。独立 HTML / React / CSS 入口，与原 Playground 同仓库构建，尚未独立域名部署。

| 页面段落 | 访客应该得到什么 | 当前实现 |
| --- | --- | --- |
| Hero | 这是什么，为什么值得摸一下 | 真实 Motion 舞台、组件面板、重播、重置、挂到页面 |
| Collection | 组件到底如何响应操作 | 11 组真实控件，24/28/32 占位切换，实验标识 |
| Material | 原始石墨灰怎样做出悬浮感 | solid/frosted、blur、opacity、panelRadius，与 Hero 同步 |
| Start | 如何放进自己的项目 | 完整挂载代码、复制、接入指南下载、Registry JSON 草案 |
| Footer | 去哪里继续探索 | GitHub、原 Playground 与动效样例 |

文案暂用“英文主标题 + 中文说明”，不是已确认的语言策略。主张是 Small controls. A little more feeling. / 让工具，也有好手感。没有付费按钮、等待名单、假安装状态或虚构用户背书。

后续正式站信息架构：Home → Components（Preview / Code / API / Accessibility）→ Installation → Theming & Motion → Recipes（浮动面板、动画调试、颜色/变换工具）→ Changelog。现有 Playground 保留为 Feel Lab 深度调参入口。

技术选择：当前先使用 Vite 多入口，避免为准备展示站引入新框架/单仓拆分。将来确定域名后，可以把 showcase 作为该站首页、Playground 移到 /playground，并准备文档路由和预渲染。目前生产产物仍是 index.html + showcase.html，不能直接把 dist 部署后就声称根路径已是官网。

上线前还应准备：最终标题/描述、canonical、社交分享图、sitemap/robots、404、各组件永久链接。域名未知，因此没有填入假 canonical 或第三方统计。Demo 动画使用本地 CSS / SVG 和现有 Motion，无远程字体、外部图片或新运行依赖。

## 源码分发路径

采用 shadcn 的分发思路是合适的：用户掌握源码，Attune 交付连同交互逻辑、tokens 和样式的可修改代码。该判断参考了 [shadcn Registry](https://ui.shadcn.com/docs/registry) 的自定义源码分发机制。

先用一个 `attune-ui` starter item 包含 23 个源文件，保留相对 import；后续拆出 core / button / slider / panel 等 items，再测共享文件更新和版本漂移。现在提前拆单文件会制造“装一个组件却缺少几何/样式”的问题。

本轮提供：

- `scripts/build-registry.mjs`：只从 index、components、core、tokens、styles 取源码；不含两个展示应用。
- `registry.json`：可审查的 manifest；`public/r/attune-ui.json` 是带 content 的生成产物。
- `scripts/check-registry.mjs`：检测依赖闭包、目标路径，展开到 .backup 的消费端并做 TypeScript 编译。
- `docs/getting-started.md`：手动复制和本地 Registry 试验流程。

target 使用 `@components/attune/`，来自 [registry-item.json 官方规范](https://ui.shadcn.com/docs/registry/registry-item-json)。真实 CLI 安装、正式域名与版本 URL 尚未验收；不要把 JSON 已生成等同于发布完成。生成文件不手改，`npm run build` 会同步生成。

## 执行顺序与验收

| 阶段 | 工作 | 过关条件 |
| --- | --- | --- |
| 当前准备 | 站点雏形、材质验证、局部挂载、源码打包与接入文档 | 构建、现有相关回归、新增浏览器/源码消费端检查通过 |
| 公开预览前 | 选择许可证、明确支持范围；完善六个核心文档；浮层/面板边界与必要无障碍修复；CLI 真实安装 | 新项目从说明开始，能独立挂出可用面板；页面与代码承诺一致 |
| 工具面板 Alpha | TextInput、Tooltip、Popover；至少一个真实外部宿主 | 用户能用数值、字符串、选择完成一个真实调参工作流 |
| 后续扩展 | ColorInput、向量字段、预设；收敛兼容矩阵 | 有真实项目反馈证明优先级，不按通用库清单追数量 |

发布方式建议先小范围开放：官网和 GitHub 承接使用路径，用两到三个可复制的场景解释价值；先收集“是否接入成功、第一处改动是什么、哪里卡住”，再考虑集中宣传。这里没有替作者发消息、发帖、部署或招募用户。

## 可以继续探索的灵感

- **Motion desk**：一块面板同时调整网站上的三个真实动画，切换柔和/利落/弹性预设，直接复制配置。强调调手感的工作流。
- **Bring your canvas**：在文档、画布、图片等背景间切换，同一块面板维持可读性。用于证明它适合外挂，而不是只适合截图。
- **Feel comparison**：同一个 Slider 左右比较不同参数；不要把实验动画强加给不需要的人，提供减少动效入口。
- **小而完整的 recipes**：动画调试面板、颜色/阴影面板、2D transform 面板，比十几个孤立的组件截图更能回答“我能拿它做什么”。

参考方向而非视觉模仿：[Leva](https://github.com/pmndrs/leva) 的 React 参数绑定，能启发未来 useControls 式接入；[Tweakpane](https://tweakpane.github.io/docs/) 的紧凑参数工作流，能帮助检验面板组合是否足够。Attune 当前仍是受控 React 组件，尚无参数自动识别或 schema 到业务状态的完整自动面板。

## 暂存的商业化想法与待讨论项

保留“基础免费、高级付费”的可能性。可以优先探索高级组合工作流（多轨编辑器、预设管理、可停靠工作台、专业 recipes），不要现在就拆分已有核心控件或实现账户/支付/授权服务器。是否收费、收费对象与时间都没有定案。

醒来后只需先讨论三组决定：

1. 首发是否接受“工具组件集的公开预览”，以 6 核心 + 3 配套 + 2 实验对外表达？
2. 主文案语言、展示站域名/托管、开源许可证。后者需作者明确选择，当前不代填 LICENSE。
3. 下一阶段先补 TextInput / Tooltip / Popover，还是先把现有六个核心的接入文档与真实项目测试做完？建议先完成接入验收，再按实际场景补控件。
