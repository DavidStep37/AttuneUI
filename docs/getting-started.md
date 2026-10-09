# Attune UI · 源码接入预览

状态：2026-10-09 本地开发预览。尚未正式发布；仓库尚无 LICENSE，公开分发前需由作者选定许可证。本指南不构成任何授权承诺。

## 已验证环境

React / React DOM 19.3、TypeScript 7、Motion 13.4、Lucide React 1.51、Vite 8（完整锁定版本见 package-lock.json）。目前验收为客户端 React + Chromium。不要据此宣称 React 18、Next.js / SSR、Safari、Firefox 或真实触屏已经兼容。

## 方式一：直接复制源码

把以下目录保持相对结构，一起复制到你项目的 `src/components/attune/`：

```text
AttuneUI/src/index.ts     → src/components/attune/index.ts
AttuneUI/src/components/ → src/components/attune/components/
AttuneUI/src/core/       → src/components/attune/core/
AttuneUI/src/tokens/     → src/components/attune/tokens/
AttuneUI/src/styles/     → src/components/attune/styles/
```

不要复制 `main.tsx`、`playground/` 或 `showcase/`。当前完整组件共享几何、tokens、feel 与样式，单独复制一个 Slider.tsx 不够；首版按工具组件套件交付，后续再拆按需安装项。

在已安装 React 19 / react-dom 19 的 TypeScript 项目中安装运行依赖：

```sh
npm install motion@^13.4.6 lucide-react@^1.51.0
```

以 `src/MotionTools.tsx` 为例：

```tsx
import { useState } from "react";
import { AttuneRoot, Panel, SliderField } from "./components/attune";
import "./components/attune/styles/attune.css";

export function MotionTools() {
  const [duration, setDuration] = useState(300);
  return (
    <AttuneRoot theme="system" material="frosted" blur={18}>
      <Panel floating title="Motion tools">
        <SliderField label="Duration" value={duration}
          onChange={setDuration} min={100} max={1000}
          step={10} unit="ms" />
      </Panel>
    </AttuneRoot>
  );
}
```

`duration` 是普通 React state，需要由你连接到实际动画。浮动面板可拖动、折叠；请挂在不受 transform / overflow 限制的页面顶层容器中。当前并非浏览器插件，也没有自动扫描页面参数的功能。

## 方式二：Registry 草案

仓库内运行 `npm run registry:build`，会生成 `registry.json`、`public/r/attune-ui.json` 和接入指南副本。Vite 构建会将公开静态文件一起写入 dist。

本地开发服务启动后可读取：`http://localhost:5188/r/attune-ui.json`。

在已配置 shadcn 的**试验项目**中，可尝试：

```sh
npx shadcn@latest add http://localhost:5188/r/attune-ui.json
```

文件目标为 `@components/attune/`，由 CLI 根据 components.json 的 components alias 解析。当前验证包括依赖闭包与独立 TypeScript 消费端；尚未完成 shadcn CLI 的端到端安装认证，所以上述命令是待验证路径。正式域名、命名空间与不可变版本 URL 尚未确定，不要把 localhost 当作已上线安装服务。套件自带 CSS，不依赖 Tailwind 的样式。

## 局部主题与材质

| AttuneRoot 属性 | 默认 | 含义 |
| --- | --- | --- |
| theme | system | light / dark / system，只影响这个挂载区域 |
| material | solid | solid / frosted，保留原始石墨灰色板 |
| blur | 18 | 0–40px 的背景模糊，frosted 时生效 |
| opacity | 0.78 | 0.55–1 的面板底色覆盖率 |
| panelRadius | 12 | 0–32px 的容器圆角，不改变 SVG 控件几何 |
| colors | 无 | 通过 ColorToken 名称覆盖局部语义色 |
| feel | 默认手感 | 组件覆盖、共享手感与 reduced 选项 |

```tsx
<AttuneRoot
  theme="light"
  material="frosted"
  colors={{ "fill-primary": "#4B5261", "slider-fill": "#4B5261" }}
  feel={{ overrides: { slider: { bulgeHeight: 6 } } }}
>
  {/* controls */}
</AttuneRoot>
```

颜色最好成对调整填充与对比文字。统一 accent→全部控件的自动配色算法尚未实现。`panelRadius` 仅控制面板，不是全局圆角旋钮；Slider、Switch、Button 等动效轮廓需要独立几何约束。

AttuneRoot 将 tokens 写在局部根节点。Select / Toast 的 body portal 会携带同一组 tokens。不要调用旧的 `injectTokens()` 来做局部挂载：它是 Playground 使用的全局注入入口。不要引入 Playground CSS；它包含页面级排版。

局部样式是类名前缀和 CSS 变量隔离，不是 Shadow DOM：宿主的全局强选择器仍可能影响控件。额外的 style 属性用于容器布局；主题覆盖请使用 colors / material 等明确属性，以便 portal 同步。

## 毛玻璃的实际边界

- 面板、下拉、输入底色和反馈层使用半透明背景 + backdrop-filter。
- Slider 的 SVG 轨道可透出后方颜色，但没有给每条动态 SVG 路径加独立背景模糊。其主要模糊来自承载面板。深色填充、白色手柄保持清晰。
- 不支持 backdrop-filter，或系统开启减少透明度时，退回实底；不会加载 liquid 提案的折射滤镜。
- 多层模糊的合成效果受浏览器 backdrop root 影响。建议只让少量浮动表面承载模糊，不把它铺满长列表。
- AttuneRoot 默认监听系统减少动态效果；`feel.reduced` 可以显式覆盖。系统减少透明度始终优先。

## 布局与交互

`size="sm" | "md" | "lg"` 对应 24 / 28 / 32px 占位，默认 md。同行控件请传同一个 size；动态轮廓可超出占位，相邻控件至少保留 8px。当前以桌面工具面板为目标，不能把 24px 直接当作移动端触屏命中区标准。

NumberInput 是数值输入，不是文本输入。Tabs、Checkbox、Select 等已有基本键盘交互；尚未完成完整屏幕阅读器验收。Toast 目前是受控单条反馈，不含全局队列或堆叠。BezierEditor / Timeline 暂列实验组件。

## 来源

- [shadcn Registry](https://ui.shadcn.com/docs/registry)
- [Registry item JSON 与 target 路径](https://ui.shadcn.com/docs/registry/registry-item-json)
- [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)

本仓库的 Registry 只是参考其源码分发协议；组件并非从 shadcn 复制，也未宣称得到其官方认证。
