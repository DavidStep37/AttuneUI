# Attune UI 接手入口

- 开始修改前先读 `Handoff-20261008.md`，再读对应组件、`src/core/schema.ts` 和 `src/tokens/tokens.ts`。
- `Handoff-20260930.md` 与 `docs/interaction-update-20261004.md` 是历史资料；与当前交接冲突时采用最新交接及用户的新指示。
- 尺寸基线为 sm/md/lg = 24/28/32px，占位与视觉形变分离。不能只改 CSS 高度而让 SVG/命中区仍用旧数值。
- 保留原版蓝调石墨灰和五套独立提案。不要恢复 Slider 质量守恒、Segmented 细颈或 Input 的旧激活动效。
- 改动后执行 `npm run build` 与相关回归脚本，脚本说明见交接文档。浏览器验证需要运行中的 `http://localhost:5188`；跨机器设置 `CHROME_PATH`。
- `.backup/` 是本机截图与诊断产物，不纳入提交。重要的当前状态写入交接文档。
