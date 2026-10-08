import { useState } from "react";
import { MotionConfig } from "motion/react";
import { Button } from "../components/Button";
import { Segmented } from "../components/Segmented";
import { Switch } from "../components/Switch";
import { AttuneProvider } from "../core/feel";
import { feel as feelTokens, spring as springTokens } from "../tokens/tokens";
import { Gallery } from "./Gallery";
import { SizingGuide } from "./SizingGuide";
import { IconReset, Logo } from "./icons";
import { IconExternal } from "../core/icons";
import { Sample } from "./Sample";
import { DemoProvider, StoreProvider, usePlaygroundStore, type Theme } from "./store";

type View = "components" | "sample";

export function App() {
  const store = usePlaygroundStore();
  const [view, setView] = useState<View>(() => (location.hash === "#sample" ? "sample" : "components"));
  const { state } = store;
  const anyChanged =
    Object.values(state.overrides).some((o) => o && Object.keys(o).length) ||
    JSON.stringify(state.shared) !== JSON.stringify(feelTokens) ||
    JSON.stringify(state.springs) !== JSON.stringify(springTokens);

  return (
    <StoreProvider store={store}>
      <AttuneProvider value={store.feel}>
        <MotionConfig reducedMotion="never">
          <DemoProvider>
            <div className="pg-app">
              <header className="pg-header">
                <div className="pg-brand">
                  <Logo />
                  <div>
                    <div className="pg-brand-name">Attune UI</div>
                    <div className="pg-brand-tag">让关联，随交互显现。</div>
                  </div>
                </div>
                <Segmented
                  aria-label="视图"
                  value={view}
                  onChange={(v) => {
                    setView(v);
                    history.replaceState(null, "", v === "sample" ? "#sample" : "#");
                  }}
                  options={[
                    { value: "components", label: "组件" },
                    { value: "sample", label: "动效样例" },
                  ]}
                />
                <div className="pg-header-tools">
                  <a href="?proposal=glass" style={{ color: "var(--at-color-accent-default)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>5 个样式提案 <IconExternal /></a>
                  <label className="pg-tool">
                    <span title="开启时跳过描边和缩放；关闭可预览完整交互">{state.reduced ? "减弱动效：绘制／缩放已关闭" : "减弱动效"}</span>
                    <Switch aria-label="减弱动效" checked={state.reduced} onChange={store.setReduced} />
                  </label>
                  <Segmented
                    aria-label="主题"
                    size="sm"
                    value={state.theme}
                    onChange={(v) => store.setTheme(v as Theme)}
                    options={[
                      { value: "system", label: "系统" },
                      { value: "light", label: "浅色" },
                      { value: "dark", label: "深色" },
                    ]}
                  />
                  <Button size="sm" variant="ghost" icon={<IconReset />} onClick={store.resetAll} disabled={!anyChanged}>
                    重置全部参数
                  </Button>
                </div>
              </header>
              <main className="pg-main">
                {view === "components" ? (
                  <>
                    <div className="pg-intro">
                      <h1>首版组件</h1>
                      <p>卡片里可以直接操作组件；点击卡片空白处展开，调整手感参数。调整会保存在本地，并同步到卡片。</p>
                    </div>
                    <Gallery />
                    <SizingGuide />
                  </>
                ) : (
                  <Sample />
                )}
              </main>
            </div>
          </DemoProvider>
        </MotionConfig>
      </AttuneProvider>
    </StoreProvider>
  );
}
