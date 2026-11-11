# Attune Motion Skill · 0.1.0 本地预览版

用户目标：在 AI 编写页面动效时，同时提供可精确调值的原生 AttuneUI 面板，避免仅靠语言反复描述快慢。第一版已提供 Skill、可复用面板、源码安装器和三组真实动效示例。

## 使用与交付

- 维护入口：`skills/attune-motion/SKILL.md`，支持文件位于同目录的 references / scripts / agents。
- 实际预览：`http://localhost:5188/motion.html`。包含卡片入场、按钮 hover、提示进出场，使用 Web Animations adapter。
- `npm run skill:pack` 将当前工作树的原生组件、tokens、styles、workbench 和示例打包到 `.backup/releases/attune-motion/`。该目录才是完整可移植 Skill；仓库的 instructions 目录不会重复提交组件源码快照。
- 将完整 `attune-motion` 文件夹放入目标代理的 skills 目录。使用提示词：`使用 $attune-motion 为当前页面加入入场和 hover 动效，挂载调参面板，并验证实时调值、重播与 JSON 复制。`
- Skill 的安装脚本只向新目录复制源码，拒绝覆盖现有目录，不替用户更改 package.json、入口或锁文件。代理接入时按实际项目安装兼容依赖，绑定真实动效。

安装 Skill 不会主动监控本地服务器；代理执行匹配的动效任务时才按 Skill 接入面板。当前版本面向 React 19 客户端项目，未声明 SSR、其他框架或所有浏览器支持。

## 行为决策

- Toolbar 默认底部居中，六点吸附；展开面板首次右上角。两者分别记忆位置。手动拖动面板后，下次展开恢复该位置，与 Toolbar 吸附点无关。
- 展开面板默认 360px 宽，最高 660px，内容在 `ScrollArea` 中滚动（自绘滚动条，无横向滚动）。header 只有标题。每个动效一个一级分组，字段（含曲线编辑器）直接列在组内，不再折叠成二级分组；Select 撑满、开关右对齐。分组编号 + 标题在左、重播与折叠箭头在右，修改圆点在参数名后，无左缩进，悬停整组呈卡片；有范围的数值一律用带滑轨的 SliderField。（0.1.1 起）
- （0.1.1 起）取消侧栏/Push 模式，工具只悬浮、不改变宿主布局。悬浮面板可拖动底边调整高度（最小 260px，不超出视口，键盘 ↑/↓），高度与位置一起记忆。
- 位置和尺寸使用可打断弹簧，文本不整体缩放；拖动即时跟手，松手吸附。工具 UI 与宿主 adapter 分别处理减少动效，面板还处理减少透明度。
- 各动效有独立 replay 回调，重播前由 adapter 取消旧运行。调参仅重播对应组，不刷新/重新挂载页面，不扫描全页动画。
- 参数不自动持久化；刷新恢复源码初值。完整 JSON 用于把调好的结果交还 AI。面板位置独立保存到 `attune-motion:placement:v1:<projectId>`。
- 导出含 schemaVersion、projectId、全部组的 label / parameters / units；与内部状态形状有区别，具体契约见 Skill references/integration.md。

## 验证

```sh
npm run build
npm run registry:check
npm run skill:check
npm run check:motion
node scripts/check-foundations.mjs
node scripts/check-sizing.mjs
```

浏览器检查依赖运行中的 `http://localhost:5188` 和本机 Chrome（跨机器设置 CHROME_PATH）。`skill:check` 把打包内容安装进独立新目录、验证拒绝覆盖和源码一致性，并类型检查完整三动效消费者；最新消费者 URL 写到 `.backup/last-skill-consumer.json`。设置 `ATTUNE_MOTION_URL` 后，可对消费者执行同一浏览器回归。

`check:motion` 验证六点真实拖动、键盘位置、首次展开/手动位置/刷新记忆、底边拉伸高度（最小值/视口边界/键盘/记忆）、宿主不重排、收起中途打断、Slider/数值输入绑定到真实动画 timing、组间隔离、全部和单项重播、菜单 hover/点击/键盘、真实剪贴板与拒绝写入回退、320/390px、减少动效与透明度、卸载清理及宿主样式保持。截图位于 `.backup/motion-review/`，不纳入提交。

当前是本地预览交付，没有发布 npm 包、部署站点或创建 GitHub Release。公开分发前仍需落实仓库交接中已列出的许可证与支持范围。

2026-10-19 实测结果：上述六项命令全部通过；维护页与独立源码消费者分别完成同一套浏览器回归。官方 Skill 校验器对指令源目录和完整包均通过。已人工检查悬浮/侧栏/320px 截图，测试浏览器为本机 Chrome。

本机完整 Skill 安装在 `E:/CodexHome/skills/attune-motion`，37 个文件与构建目录逐字节一致。归档文件为 `.backup/releases/attune-motion-v0.1.0.zip`，可把其中的 `attune-motion` 文件夹作为完整 Skill 安装到其他环境。

## 0.1.2 · 跨机器 / 跨代理一致性

- 包内新增 `references/visual-spec.md`（尺寸、字段→控件映射、禁止事项）、`assets/reference/*.png`（Toolbar、菜单、面板、悬停卡片、曲线容器的 1440×960@2x 基准图）和 `scripts/verify-example.mjs`（与维护仓库 `check:motion` 同一份回归；按系统查找 Chrome/Chromium/Edge，`puppeteer-core` 从运行目录的项目解析，截图目录 `ATTUNE_SHOT_DIR`）。
- 修复 `install.mjs` 在 Node 22 / macOS 上的 EEXIST：先独占创建目标目录，再逐项复制目录内容。打包前清空输出目录，避免旧文件残留。`skill:check` 额外检查基准图、视觉规范、自检脚本存在且分发文件不含本机路径。
- 实测：把打包后的 Skill 复制到仓库外的临时目录，新建只含公开 npm 依赖的 Vite 项目，用 `install.mjs` 安装源码与示例，`tsc` 通过，`verify-example.mjs` 全部通过；与基准图逐像素对比，面板、悬停卡片、曲线容器 0% 差异，Toolbar 约 1%（仅示例页背景文字不同）。仍只在本机 Chrome（macOS）上验证，未覆盖 Firefox/Safari/Windows 字体差异。

## 0.2.0 · 界面方案二选一、设计组 Token

- 接入前选择界面方案：A 使用 AttuneUI 组件库（默认，外观与回归一致）；B 自行绘制（`install.mjs --ui custom` 只安装零依赖的 `model.ts`，按 `references/custom-ui.md` 用宿主组件实现同样的行为、JSON 和 token 规则）。用户未指定时由代理询问。
- 设计组 motion token 作为预设：传入 `tokens` 后面板底部出现“启用预设”开关按钮（组件库 ToggleButton，无弹窗），匹配的数值字段改为 token 下拉（可选“自定义”展开连续滑块自由调节；混合长/中/短 token 做成刻度滑块过密，已放弃），曲线预设换成 easing token，导出 JSON 带 `tokenSet` 与 `tokens`。格式与映射规则见 `references/integration.md#设计组-token`。
- 面板滚动条在操作其他控件时不再响应悬停。

## 0.3.0 · 预设开关、抬升面板、贴合高度

- 设计组 token 改为一套预设：`tokens` prop + footer 的“启用预设”开关按钮（组件库 `ToggleButton`），去掉加载弹层与粘贴/文件入口；`defaultPresetEnabled` 控制首次状态，`tokenLibrary` 为兼容别名。开启后匹配字段使用 `TokenField`。
- 展开面板分为外框（header/footer）与内缩的抬升参数面板（半透明面板色、16px 圆角），组间通栏分隔线，悬停分组点亮；外框圆角 24px；“重播全部”为图标按钮；分组描述只作标题悬停提示。
- 高度：分组默认折叠，面板贴合内容随展开变高，上限为 min(内容高度, 视口 − 48)；拖动底边设置的是上限（不留空白），双击恢复；抬升面板内无滚动条，底部渐隐提示还有内容。位置存储升级为 v2（v1 只迁移位置）。
- 组件库同步：下拉展开样式（底环 + 白色表头 + 当前值浅底）、圆盘选中胶囊与液面填充、ScrollArea `scrollbar` / `fade`、PanelGroup 受控 `open`。

## 1.0.0 · 发布版

- 发布内容即 `npm run skill:pack` 生成的 `.backup/releases/attune-motion/`（SKILL.md、agents/openai.yaml、references 五份、assets：组件源码快照 / 示例 / token 样例 / 基准截图、scripts：install.mjs 与 verify-example.mjs），并打包为 `.backup/releases/attune-motion-v1.0.0.zip`。
- 相对 0.3.0：展开面板整个 header 可拖动；分组标题行与首个参数间距 8px；合入远端性能优化（几何计算提速、AttuneRoot 上下文缓存、工作台参数树缓存：拖动面板时 Slider 重渲染由每帧全部降为 0）。
- 发布前验证：build、typecheck、registry:check、skill:check（含 custom 安装、无本机路径）、check:motion（维护页与已安装消费者）、组件库回归，以及仓库外全新项目的安装 + tsc + verify-example。仅在 macOS Chrome 上验证；未覆盖 Firefox / Safari / Windows 字体、SSR、React 18。仓库仍无 LICENSE，对外发布前需选定许可证。

