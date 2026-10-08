# Attune UI

个人组件库 Attune UI，附组件 Playground、动效调试样例和五套独立视觉提案。

**接手项目先读 [Handoff-20261008.md](Handoff-20261008.md)**：当前尺寸规则、组件交互、代码地图、运行验证和已知边界。`Handoff-20260930.md` 为早期设计背景，部分规则已被后续交互迭代替代。

## 运行

```bash
npm install
npm run dev        # http://localhost:5188
npm run build      # 类型检查 + 生产构建
```

- `http://localhost:5188/`：组件 Playground
- `http://localhost:5188/#sample`：动效样例（卡片错落入场 + 调试面板）
- `http://localhost:5188/#sizing`：三档尺寸的横排组合与动效对齐示例
- `http://localhost:5188/?proposal=glass`：五个独立样式提案（冰蓝玻璃、纸感编辑、精密仪表、柔软糖果、大胆构造）；原版样式与参数保留。调研来源及设计取舍见 `docs/style-proposals-20261004.md`。

## 目录

```
src/
  tokens/        design token 唯一来源（tokens.ts），css.ts 由此生成 CSS 变量
  core/
    schema.ts    各组件“可调手感参数”的声明（Playground 面板由此自动生成）
    feel.tsx     AttuneProvider / useFeel：解析共享参数、继承关系、减弱动效
    geometry.ts  可变形视觉层的几何：软轨道、轮廓采样、橡皮筋、贝塞尔求值
    hooks.ts     可打断的动画值、尺寸监听等
  components/    Slider、Input、Timeline、Button、BezierEditor、Switch、
                 Segmented、Select、Checkbox、Alert / Message / Toast、Tabs，
                 以及 ValueRoll 和 Panel（面板、分组、参数行）
  styles/        组件样式（只引用 token）
  playground/    展示页：卡片、弹窗调参、动效样例
scripts/shot.mjs 开发用：用本机 Chrome 截图并收集控制台错误
```

## 使用

```tsx
import { AttuneProvider, Slider, SliderField } from "./src";

<AttuneProvider value={{ reduced: false, overrides: { slider: { bulgeHeight: 8 } } }}>
  <SliderField label="时长" value={v} onChange={setV} min={0} max={1000} step={10} unit="ms" />
</AttuneProvider>;
```

- 每个组件也接受 `feel` 属性，只覆盖当前实例的手感参数。
- 共享参数（`feel.*`、`spring.*`）会影响引用它们的组件；具体范围见调参面板说明。
- 单行组件使用 `size="sm" | "md" | "lg"`，占位 24 / 28 / 32px，默认 md；正文 12px / 16px 行高。同排使用同档，小控件保持视觉比例，动效不改变布局占位。尺寸 API 与特殊组件规则见最新交接文档。

新增基础组件也已接入 Playground 调参面板：Checkbox 支持半选、禁用与原生键盘操作；Tabs 支持方向键和 Home / End；反馈组件的弹出位移、回弹、停留时间、消散模糊和手动爆开倍率均可调整。

```tsx
<Checkbox checked={enabled} onChange={setEnabled}>启用效果</Checkbox>
<Toast open={noticeOpen} onDismiss={() => setNoticeOpen(false)}
  feel={{ enterOffset: 8, duration: 3200 }} tone="success">设置已更新</Toast>
<Tabs aria-label="项目设置" value={tab} onChange={setTab}
  items={[{ value: "overview", label: "概览", content: <Overview /> },
          { value: "motion", label: "动效", content: <MotionSettings /> }]} />
```

`Alert` 默认常驻；`Message` 原位显示，`Toast` 显示于页面上方。`onDismiss` 接收 `manual` 或 `auto`，由调用方关闭 `open`；传入 `duration={0}` 可关闭自动消失。悬停或键盘聚焦会暂停倒计时。手动关闭放大后模糊消散，自动关闭只模糊淡出。

历史交互记录见 `docs/interaction-update-20261004.md`，最新状态以 [Handoff-20261008.md](Handoff-20261008.md) 为准。Slider 已取消方向性粗细补偿，Input 当前使用下划线→hover 描框→聚焦外扩，Segmented 滑动中填满鼓包内侧，不再收成细颈。
