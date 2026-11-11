# 自绘界面方案（不使用 AttuneUI 组件库）

用户选择“自己绘制”时使用本文件。目标：调参面板的外观跟随宿主项目（它的组件库、配色、字号、圆角），但**行为和导出数据**与 AttuneUI 版本一致，设计师复制回来的 JSON 两种方案可以通用。

## 安装

```sh
node <skill>/scripts/install.mjs --ui custom --target <项目内目录>
```

只安装一个无依赖的 `model.ts`（数据契约），不安装 React 组件和样式，也不需要 motion / lucide。它提供：

| 导出 | 用途 |
| --- | --- |
| `MotionDefinition` / `MotionField` / `MotionConfig` | 动效与字段注册、受控配置（与 integration.md 相同） |
| `createMotionConfig(projectId, definitions)` | 初始配置；也是“重置全部参数”的目标值 |
| `serializeMotionConfig(config, definitions, tokenSet?)` | 复制用的完整 JSON（含 tokenSet 与各参数命中的 token 名） |
| `parseMotionTokens(jsonOrObject)` | 解析设计组 token 文件，格式错误时抛出可直接显示的中文错误 |
| `tokensForField(field, tokenSet)` | 某字段可用的 token（已换算单位、按范围过滤、排序；可能含无名的 0） |
| `tokenNameFor(field, value, tokenSet)` | 当前值对应的 token 名 |
| `snapConfigToTokens(config, definitions, tokenSet)` | 加载 token 时把 token 字段取到最近的 token |
| `anchors` / `anchorPoint` / `nearestAnchor` / `clampPoint` | Toolbar 六点吸附与面板收进视口的几何 |

不要为了自绘再手写一份 JSON 格式或 token 解析——用 `model.ts`，导出才能与 AttuneUI 版本互通。

## 外观

- 使用宿主已有的组件（按钮、滑块、开关、下拉、输入框、弹层）和设计 token；没有现成组件时按宿主风格补齐，保持与页面一致。不要照搬 AttuneUI 的石墨灰与磨砂玻璃，除非用户要求。
- 面板必须与页面明显分层（阴影、边框或背景），不能被误认为页面内容；文字对比度满足可读性。
- 结构参照方案 A：外框（header + footer）+ 内缩的抬升参数面板，组间用贴满该面板宽度的通栏分隔线；具体颜色与尺寸用宿主体系。
- 控件尺寸、间距、圆角由宿主设计体系决定；`visual-spec.md` 中的像素值只适用于 AttuneUI 方案。

## 必须实现的行为

与 SKILL.md“面板必须遵守的行为”一致，以下为最低要求：

1. 两种形态：收起的 Toolbar（拖动手柄、展开、全部重播、复制）与悬浮面板。面板只悬浮，不推挤或重排宿主页面；位置（以及可调的高度）按 projectId 记忆。
2. 每个动效一个分组：单项重播（放在名称前，与底部“全部重播”纵向对齐）+ 名称 + 折叠，不显示编号；字段直接放在分组下，不嵌套二级分组。
3. 字段控件：有范围的 number 用“滑块 + 可编辑读数”；boolean 用开关且靠右；select 撑满整行；bezier 用可拖动控制点的曲线编辑器 + 逗号分隔的数值输入框（placeholder `x1,y1,x2,y2`）+ 预设选择，没有匹配预设时显示“自定义”，超出范围的控制点不能画出容器。若用圆盘选择预设：选中项用扇区内侧、距扇区轮廓 2.5px 的弯曲胶囊标记；悬停填充像液面从内缘向外缘升起，两侧始终贴着扇区直边（不要用缩放实现），退回时无回弹。
4. 参数被修改后可单项重置；底部有“重置全部参数”（未修改时禁用）。
5. 全部重播 / 单项重播只调用已注册 adapter；复制使用 `serializeMotionConfig`，成功写入剪贴板才提示成功，失败时提供可手动复制的文本。
6. Token：项目提供 token 集时，在面板底部按钮行放一个与旁边按钮同尺寸的**开关按钮**（关：图标按钮；开：选中填充 + “启用预设” + ×，`aria-pressed`），不做弹窗；用 `parseMotionTokens` 在代码里解析 token 文件。开启后：
   - `tokensForField` 返回 2 个及以上值的数值字段改为 **token 选择**：用宿主的下拉/选择组件列出 token（名称 + 数值，打开时定位到当前项），不显示滑块；第一项“自定义”取消 token，展开连续滑块 + 数值输入自由调节，再选 token 即收起；自定义状态下导出不带该参数的 token 名。不要用刻度滑块承载混合长/中/短的 token。
   - 曲线字段的预设换成 easing token；
   - 用 `snapConfigToTokens` 把当前值吸附到最近 token，并告知吸附了几项；
   - 关闭开关即恢复连续滑块（数值保留）；开关状态按 projectId 记忆。
7. 面板内的滚动不应干扰控件：拖动滑块等操作时，面板滚动条不响应悬停或抢占指针。
8. 键盘可达（Toolbar、菜单、字段、曲线控制点、预设开关），尊重 `prefers-reduced-motion` 与 `prefers-reduced-transparency`。

## 验证

`scripts/verify-example.mjs` 针对 AttuneUI 示例，不适用于自绘界面。按 verification.md 第 1–8 项手动或用项目自己的浏览器测试完成，并额外检查上面第 6 项（加载、分段吸附、键盘、导出 tokens、移除）。交付时说明使用的是自绘方案、采用了哪些宿主组件、哪些行为未实现或未验证。
