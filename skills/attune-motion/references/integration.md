# React 接入与配置契约

使用包内脚本，不依赖发布到 npm 的 `attune-ui` 包：

```sh
node <skill目录>/scripts/install.mjs --target <项目>/src/attune
# 可选：同时复制可运行三动效示例，需将项目入口指向生成的 main.tsx
node <skill目录>/scripts/install.mjs --target <项目>/src/attune --example <项目>/src/attune-example
```

`--example` 与 `--target` 必须都是不存在的目录，不能嵌套。脚本不改 package.json、锁文件或页面入口。先检查输出的依赖版本，再用项目包管理器补足。已接入过的项目直接使用现有组件，升级源码需要先审查差异。

## 最小数据流

```tsx
import { useState } from 'react';
import { MotionWorkbench, createMotionConfig, type MotionDefinition } from './attune';
import './attune/styles/attune.css';

// replayCard 是宿主 adapter：取消旧动画，再按这份参数启动，单位在边界转换。
const definitions: MotionDefinition[] = [{
  id: 'card.enter', label: '卡片入场',
  fields: [{ type: 'number', key: 'duration', label: '渐入时长',
    default: 480, min: 0, max: 2000, step: 10, unit: 'ms' }],
  replay: params => replayCard({ durationMs: Number(params.duration) }),
}];

function Preview() {
  const [config, setConfig] = useState(() => createMotionConfig('my-page', definitions));
  return <MotionWorkbench definitions={definitions} config={config} onChange={setConfig}>
    <Page motionParams={config.animations} />
  </MotionWorkbench>;
}
```

`Page` 必须读取 `motionParams`。示意代码中的 `Page` / `replayCard` 要替换为真实项目组件和函数。不要仅把面板放上去却让动画仍读取硬编码常量。可对每组参数使用独立 effect 触发实时预览，或更新动画引擎；不要在某一组改变时重播所有组。包内 `assets/example/main.tsx` 展示了真实 Web Animations 绑定、精确时序、取消旧运行及卸载清理。

`definitions` 是此页面的固定注册表；每个 id/field key 唯一，config 必须含全部组和字段。创建配置前构造完整 definitions；页面注册表变化时重新生成或迁移配置，并用 `key={projectId}` 重挂载工具，不能将新字段指向 undefined。第一版没有任意远程 JSON 导入、配置迁移或运行时 schema 编辑器。

支持字段的准确联合类型见 `assets/attune-source/workbench/model.ts`。number 必须有有限的 min/max/step（min <= default <= max, step > 0）；select 的默认值必须存在于 options；bezier 是 `[x1,y1,x2,y2]`，x 在 0–1。参数范围由实际动效决定，避免复制示例范围到无关参数。

## 重播 adapter

- `replay(params)` 得到点击时最新参数；可返回 void 或 Promise。同步异常/Promise 拒绝会显示失败组名。快速连续重播时先 cancel 上一轮，再从初态开始。
- 动画引擎仍由宿主拥有：CSS 可更新局部变量并重新触发具体元素；Motion 可使用局部 controls；WAAPI 可取消并重新 animate。不要修改全局动画时钟。
- 对 hover，单项重播模拟一次进入和离开；对页面转场，提供可逆的本地预览，不为了重播执行真实跳转/提交。
- 尊重减少动效。面板自身已处理系统偏好，宿主 adapter 也要处理。

## 导出结构

```json
{
  "schemaVersion": 1,
  "projectId": "my-page",
  "animations": {
    "card.enter": {
      "label": "卡片入场",
      "parameters": { "duration": 480 },
      "units": { "duration": "ms" }
    }
  }
}
```

这是给设计师复制回 AI 的交接格式，保留所有已注册参数。它与内部 `MotionConfig.animations[id]` 的扁平参数对象不同，不能直接 `setConfig(JSON.parse(export))`。将用户提供的 JSON 应用回代码时，检查 schemaVersion/projectId/id/字段/类型/范围，取 `animations[id].parameters` 更新对应默认值；未匹配的字段先报告，不悄悄丢弃。

参数默认只保存在内存；刷新恢复源码默认参数。面板位置以 `attune-motion:placement:v1:<projectId>` 单独存储；没有修改原 Playground 或 glass/liquid 的存储。需要跨刷新保存参数时，可基于已验证 schema 增加项目自己的存储，而不是直接信任 localStorage JSON。

## Push 与宿主布局

默认展开宽 360px，高不超过 660px。侧栏位于右侧，工具 wrapper 的 margin-right 与侧栏尺寸一起动画。把页面响应式容器放到 wrapper 下，不应保留 width:100vw 这类绕过容器宽度的样式。

固定定位页头/弹层/画布、第三方 iframe 不会自动响应 margin。接入时检查这些元素，为它们接入同一宽度约束或改为布局容器内定位。不要对 body 或页面根节点加 scale 或全局 transform 来假装 Push。工具通过 body portal 脱离宿主 transform，层级默认 900，Attune 下拉为 1000；若宿主层级不同，统一调整同一套层级，不单独把面板提到下拉上面。

只覆盖 `.at-mw-*` 的壳布局即可；原生控件颜色、尺寸、SVG、命中区继续使用 AttuneUI tokens。局部样式不是 Shadow DOM，强全局选择器仍可能干扰，需要实测。
