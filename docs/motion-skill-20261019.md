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
- 展开面板默认 360px 宽，最高 660px，内容滚动；曲线编辑器默认折叠以优先露出常用参数。
- 侧栏通过工具 wrapper 的 margin-right 推动宿主响应式布局，侧栏可拖出成为悬浮面板。小于 720px 时提示并回退悬浮，恢复宽屏时继续侧栏。
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

`check:motion` 验证六点真实拖动、键盘位置、首次展开/手动位置/刷新记忆、真实 Push 与中途打断、Slider/数值输入绑定到真实动画 timing、组间隔离、全部和单项重播、菜单 hover/点击/键盘、真实剪贴板与拒绝写入回退、320/390px、减少动效与透明度、卸载清理及宿主样式保持。截图位于 `.backup/motion-review/`，不纳入提交。

当前是本地预览交付，没有发布 npm 包、部署站点或创建 GitHub Release。公开分发前仍需落实仓库交接中已列出的许可证与支持范围。

2026-10-19 实测结果：上述六项命令全部通过；维护页与独立源码消费者分别完成同一套浏览器回归。官方 Skill 校验器对指令源目录和完整包均通过。已人工检查悬浮/侧栏/320px 截图，测试浏览器为本机 Chrome。

本机完整 Skill 安装在 `E:/CodexHome/skills/attune-motion`，37 个文件与构建目录逐字节一致。归档文件为 `.backup/releases/attune-motion-v0.1.0.zip`，可把其中的 `attune-motion` 文件夹作为完整 Skill 安装到其他环境。
