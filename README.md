# Attune UI

个人组件库 Attune UI 的首版实现，附组件 Playground 和动效调试样例。设计背景与规则见 `Handoff-20260930.md`。

## 运行

```bash
npm install
npm run dev        # http://localhost:5188
npm run build      # 类型检查 + 生产构建
```

- `http://localhost:5188/`：组件 Playground
- `http://localhost:5188/#sample`：动效样例（卡片错落入场 + 调试面板）

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
                 Segmented、Select，以及 ValueRoll 和 Panel（面板、分组、参数行）
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
- 共享参数（`feel.*`、`spring.*`）改动后，会同时影响所有组件。
