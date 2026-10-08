import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, useMotionValue } from "motion/react";
import { BezierField, formatBezier, type Bezier } from "../components/BezierEditor";
import { Button } from "../components/Button";
import { Panel, PanelGroup, Row, SliderField } from "../components/Panel";
import { Segmented } from "../components/Segmented";
import { Select } from "../components/Select";
import { SwitchField } from "../components/Switch";
import { Timeline, type TimelineItem } from "../components/Timeline";
import { springSettleMs } from "../core/geometry";
import { useFeelState } from "../core/feel";
import { IconCheck, IconCopy, IconPlay, IconReset } from "./icons";

type Order = "row" | "col" | "diag" | "reverse" | "center";

type Cfg = {
  duration: number;
  delay: number;
  stagger: number;
  distance: number;
  type: "bezier" | "spring";
  bezier: Bezier;
  stiffness: number;
  damping: number;
  order: Order;
  fade: boolean;
  scaleOn: boolean;
  scaleFrom: number;
  blurOn: boolean;
  blurFrom: number;
};

const DEFAULT: Cfg = {
  duration: 480,
  delay: 0,
  stagger: 80,
  distance: 24,
  type: "bezier",
  bezier: [0.16, 1, 0.3, 1],
  stiffness: 260,
  damping: 24,
  order: "row",
  fade: true,
  scaleOn: false,
  scaleFrom: 0.94,
  blurOn: false,
  blurFrom: 8,
};

const ROWS = 2;
const COLS = 3;
const N = ROWS * COLS;

function orderIndex(i: number, order: Order) {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  switch (order) {
    case "row":
      return i;
    case "col":
      return c * ROWS + r;
    case "diag":
      return r + c;
    case "reverse":
      return N - 1 - i;
    case "center":
      return Math.abs(c - 1) * 2 + r;
  }
}

const orderOptions = [
  { value: "row", label: "按行", hint: "1 → 6" },
  { value: "col", label: "按列", hint: "↓ 再 →" },
  { value: "diag", label: "对角线", hint: "↘" },
  { value: "reverse", label: "倒序", hint: "6 → 1" },
  { value: "center", label: "从中间列", hint: "◎" },
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const mockTitles = ["用量概览", "成员管理", "部署记录", "告警规则", "账单", "API 密钥"];

export function Sample({ floating = true }: { floating?: boolean }) {
  const { reduced } = useFeelState();
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [auto, setAuto] = useState(true);
  const [copied, setCopied] = useState(false);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const playhead = useMotionValue(0);
  const controls = useRef<{ stop: () => void }[]>([]);

  const set = <K extends keyof Cfg>(k: K) => (v: Cfg[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const mod = (k: keyof Cfg) => !same(cfg[k], DEFAULT[k]);
  const reset = (k: keyof Cfg) => () => setCfg((c) => ({ ...c, [k]: DEFAULT[k] }));

  const springMs = useMemo(() => springSettleMs(cfg.stiffness, cfg.damping), [cfg.stiffness, cfg.damping]);
  const effDuration = cfg.type === "bezier" ? cfg.duration : springMs;
  const idx = useMemo(() => Array.from({ length: N }, (_, i) => orderIndex(i, cfg.order)), [cfg.order]);
  const total = cfg.delay + Math.max(...idx) * cfg.stagger + effDuration;

  const items: TimelineItem[] = idx.map((k, i) => ({
    id: String(i),
    label: `卡片 ${i + 1}`,
    delay: cfg.delay + k * cfg.stagger,
    duration: effDuration,
    resizable: cfg.type === "bezier",
  }));

  const play = useCallback(() => {
    controls.current.forEach((c) => c.stop());
    controls.current = [];
    const c = cfg;
    cards.current.forEach((el, i) => {
      if (!el) return;
      const k = orderIndex(i, c.order);
      const delay = reduced ? 0 : (c.delay + k * c.stagger) / 1000;
      const motionT =
        reduced ? { duration: 0 } : c.type === "bezier"
          ? { duration: c.duration / 1000, ease: c.bezier, delay }
          : { type: "spring" as const, stiffness: c.stiffness, damping: c.damping, delay };
      const fadeT = { duration: reduced ? 0 : Math.min(effDuration, 360) / 1000, ease: [0.2, 0, 0, 1] as Bezier, delay };
      el.style.opacity = c.fade ? "0" : "1";
      controls.current.push(
        animate(el, { y: [c.distance, 0], scale: [c.scaleOn ? c.scaleFrom : 1, 1] }, motionT),
        animate(el, { opacity: [c.fade ? 0 : 1, 1], filter: [c.blurOn ? `blur(${c.blurFrom}px)` : "blur(0px)", "blur(0px)"] }, fadeT),
      );
    });
    controls.current.push(animate(playhead, [0, total], { duration: reduced ? 0 : total / 1000, ease: "linear", onComplete: () => playhead.set(0) }));
  }, [cfg, effDuration, total, playhead, reduced]);

  useEffect(() => () => controls.current.forEach((c) => c.stop()), []);

  // replay after changes (debounced), and once on mount
  const first = useRef(true);
  useEffect(() => {
    if (!first.current && !auto && !reduced) return;
    const tm = setTimeout(play, first.current ? 200 : 380);
    first.current = false;
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, reduced]);

  const onBar = (id: string, n: { delay: number; duration: number }) => {
    const i = Number(id);
    const k = idx[i];
    setCfg((c) => {
      const cur = c.delay + k * c.stagger;
      const next = { ...c };
      if (n.duration !== effDuration && c.type === "bezier") next.duration = n.duration;
      if (n.delay !== cur) {
        if (k === 0) next.delay = n.delay;
        else next.stagger = Math.max(0, Math.round((n.delay - c.delay) / k));
      }
      return next;
    });
  };

  const changed = (Object.keys(DEFAULT) as (keyof Cfg)[]).filter((k) => mod(k));

  const exportJSON = () => {
    const anim: Record<string, unknown> = {
      type: cfg.type,
      duration: cfg.type === "bezier" ? { value: cfg.duration, unit: "ms" } : { value: springMs, unit: "ms", note: "弹簧预计稳定时长" },
      delay: { value: cfg.delay, unit: "ms" },
      stagger: { value: cfg.stagger, unit: "ms" },
      order: cfg.order,
      from: {
        y: { value: cfg.distance, unit: "px" },
        opacity: cfg.fade ? 0 : 1,
        ...(cfg.scaleOn ? { scale: cfg.scaleFrom } : {}),
        ...(cfg.blurOn ? { blur: { value: cfg.blurFrom, unit: "px" } } : {}),
      },
    };
    if (cfg.type === "bezier") anim.easing = { cubicBezier: cfg.bezier, css: `cubic-bezier(${formatBezier(cfg.bezier)})` };
    else anim.spring = { stiffness: cfg.stiffness, damping: cfg.damping, mass: 1 };
    const payload = {
      target: "卡片错落入场（2 行 × 3 列，共 6 张）",
      animation: anim,
      changed,
      timeline: items.map((it) => ({ card: Number(it.id) + 1, delay: it.delay, duration: it.duration })),
    };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="pg-sample">
      <div className="pg-sample-stage">
        <div className="pg-sample-caption">
          <span>样例 · 卡片错落入场</span>
          <span className="pg-sample-total">
            总时长 <b>{total}</b> ms
          </span>
        </div>
        <div className="pg-sample-grid">
          {Array.from({ length: N }, (_, i) => (
            <div
              key={i}
              className="pg-mock"
              ref={(el) => {
                cards.current[i] = el;
              }}
            >
              <div className="pg-mock-head">
                <span className="pg-mock-icon" />
                <span className="pg-mock-order">{idx[i] + 1}</span>
              </div>
              <div className="pg-mock-title">{mockTitles[i]}</div>
              <div className="pg-mock-line" />
              <div className="pg-mock-line pg-mock-line-short" />
            </div>
          ))}
        </div>
      </div>

      <Panel
        floating={floating}
        className="pg-sample-panel"
        title="动效调试"
        subtitle={changed.length ? `已修改 ${changed.length} 项` : "卡片错落入场"}
        footer={
          <>
            <Button variant="primary" icon={<IconPlay />} onClick={play}>
              播放
            </Button>
            <Button icon={<IconReset />} onClick={() => setCfg(DEFAULT)} disabled={!changed.length}>
              重置
            </Button>
            <Button icon={copied ? <IconCheck /> : <IconCopy />} onClick={exportJSON}>
              {copied ? "已复制" : "复制 JSON"}
            </Button>
          </>
        }
      >
        <PanelGroup title="时间">
          {cfg.type === "bezier" ? (
            <SliderField label="时长" value={cfg.duration} onChange={set("duration")} min={100} max={1500} step={10} unit="ms" modified={mod("duration")} onReset={reset("duration")} />
          ) : (
            <Row label="时长">
              <span className="pg-readonly">
                ≈ {springMs} <em>ms · 由弹簧决定</em>
              </span>
            </Row>
          )}
          <SliderField label="整体延迟" value={cfg.delay} onChange={set("delay")} min={0} max={1000} step={10} unit="ms" modified={mod("delay")} onReset={reset("delay")} />
          <SliderField label="交错间隔" value={cfg.stagger} onChange={set("stagger")} min={0} max={300} step={5} unit="ms" modified={mod("stagger")} onReset={reset("stagger")} />
          <div className="pg-sample-tl">
            <Timeline aria-label="6 张卡片的时间轴" items={items} onChange={onBar} playhead={playhead} step={5} rowHeight={20} labelWidth={44} />
          </div>
        </PanelGroup>

        <PanelGroup title="运动">
          <Row label="缓动类型" modified={mod("type")} onReset={reset("type")}>
            <Segmented
              aria-label="缓动类型"
              fullWidth
              value={cfg.type}
              onChange={set("type")}
              options={[
                { value: "bezier", label: "贝塞尔" },
                { value: "spring", label: "弹簧" },
              ]}
            />
          </Row>
          {cfg.type === "bezier" ? (
            <BezierField label="缓动曲线" value={cfg.bezier} onChange={set("bezier")} size={200} />
          ) : (
            <>
              <SliderField label="刚度" value={cfg.stiffness} onChange={set("stiffness")} min={30} max={1000} step={10} modified={mod("stiffness")} onReset={reset("stiffness")} />
              <SliderField label="阻尼" value={cfg.damping} onChange={set("damping")} min={2} max={80} step={1} modified={mod("damping")} onReset={reset("damping")} />
            </>
          )}
          <SliderField label="位移距离" value={cfg.distance} onChange={set("distance")} min={0} max={80} step={1} unit="px" modified={mod("distance")} onReset={reset("distance")} />
          <Row label="出现顺序" modified={mod("order")} onReset={reset("order")}>
            <Select aria-label="出现顺序" value={cfg.order} onChange={(v) => set("order")(v as Order)} options={orderOptions} width="100%" />
          </Row>
        </PanelGroup>

        <PanelGroup title="效果">
          <SwitchField label="渐显" checked={cfg.fade} onChange={set("fade")} />
          <SwitchField label="缩放" checked={cfg.scaleOn} onChange={set("scaleOn")}>
            <SliderField label="起始缩放" value={cfg.scaleFrom} onChange={set("scaleFrom")} min={0.6} max={1} step={0.01} unit="×" modified={mod("scaleFrom")} onReset={reset("scaleFrom")} />
          </SwitchField>
          <SwitchField label="模糊" checked={cfg.blurOn} onChange={set("blurOn")}>
            <SliderField label="起始模糊" value={cfg.blurFrom} onChange={set("blurFrom")} min={0} max={24} step={0.5} unit="px" modified={mod("blurFrom")} onReset={reset("blurFrom")} />
          </SwitchField>
        </PanelGroup>

        <PanelGroup title="播放">
          <SwitchField label="修改后自动重播" checked={auto} onChange={setAuto} />
        </PanelGroup>
      </Panel>
    </div>
  );
}
