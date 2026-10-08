import { useEffect, useRef, useState, type PointerEvent } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { Button } from "../components/Button";
import { PanelGroup, ParamControls } from "../components/Panel";
import { resolveComponent, resolveDefault, springTransition, useFeelState } from "../core/feel";
import { componentMeta, componentSchemas, sharedSchema, springSchema, type ComponentId, type ParamDef, type ParamValue } from "../core/schema";
import { type SharedFeel, type SpringName } from "../tokens/tokens";
import { demos, hints } from "./demos";
import { IconCheck, IconClose, IconCopy, IconExpand, IconReset } from "./icons";
import { useStore } from "./store";

export const ORDER: ComponentId[] = ["slider", "input", "button", "timeline", "bezier", "switch", "segmented", "select", "checkbox", "feedback", "tabs"];

export function Gallery() {
  const [openId, setOpenId] = useState<ComponentId | null>(null);
  const lastCard = useRef<HTMLElement | null>(null);
  return (
    <>
      <div className="pg-grid">
        {ORDER.map((id) => (
          <Card
            key={id}
            id={id}
            open={openId === id}
            onOpen={(el) => {
              lastCard.current = el;
              setOpenId(id);
            }}
          />
        ))}
      </div>
      <AnimatePresence>
        {openId && (
          <ComponentModal
            key={openId}
            id={openId}
            onClose={() => {
              setOpenId(null);
              requestAnimationFrame(() => lastCard.current?.focus({ preventScroll: true }));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Card({ id, open, onOpen }: { id: ComponentId; open: boolean; onOpen: (el: HTMLElement) => void }) {
  const meta = componentMeta[id];
  const Demo = demos[id];
  const { springs, reduced } = useFeelState();
  const down = useRef<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLElement>(null);

  // operating a component inside the card never opens the modal
  const onPointerDown = (e: PointerEvent) => {
    down.current = (e.target as HTMLElement).closest("[data-at-interactive]") ? null : { x: e.clientX, y: e.clientY };
  };
  const onClick = (e: React.MouseEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || (e.target as HTMLElement).closest("[data-at-interactive]")) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    onOpen(ref.current!);
  };

  return (
    <div className="pg-card-slot" data-component={id} data-wide={id === "timeline" || undefined} data-open={open || undefined}>
      <motion.article
        ref={ref}
        layoutId={`card-${id}`}
        className="pg-card"
        tabIndex={0}
        aria-label={`${meta.name} ${meta.en}，按 Enter 打开详情`}
        style={{ borderRadius: 12 }}
        transition={springTransition(springs.pop, reduced)}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) onOpen(ref.current!);
        }}
      >
        <header className="pg-card-head">
          <div>
            <span className="pg-card-name">{meta.en}</span>
            <span className="pg-card-cn">{meta.name}</span>
          </div>
          <span className="pg-card-open" aria-hidden>
            <IconExpand />
          </span>
        </header>
        <div className="pg-card-stage">
          <Demo variant="card" />
        </div>
        <footer className="pg-card-foot">{meta.metaphor}</footer>
      </motion.article>
    </div>
  );
}

function ComponentModal({ id, onClose }: { id: ComponentId; onClose: () => void }) {
  const meta = componentMeta[id];
  const Demo = demos[id];
  const store = useStore();
  const { shared: feelTokens, springs: springTokens } = store.baseline;
  const { feel } = store;
  const { springs, reduced } = useFeelState();
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const present = useIsPresent();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    boxRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const schema = componentSchemas[id] as ParamDef[];
  const values = resolveComponent(id, feel) as Record<string, ParamValue>;
  const defaults = Object.fromEntries(schema.map((d) => [d.key, resolveDefault(d, feel)]));
  const changed = feel.overrides[id] ?? {};
  const nChanged = Object.keys(changed).length;

  const sharedChanged = Object.fromEntries(Object.entries(feel.shared).filter(([k, v]) => feelTokens[k as keyof SharedFeel] !== v));
  const springsChanged = Object.fromEntries(
    Object.entries(feel.springs).filter(([k, v]) => {
      const d = springTokens[k as SpringName];
      return d.visualDuration !== v.visualDuration || d.bounce !== v.bounce;
    }),
  );

  const copy = async () => {
    const payload = {
      component: meta.en,
      token: `${id}.*`,
      feel: values,
      changed,
      shared: { changed: sharedChanged, springs: springsChanged },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {
      /* clipboard may be unavailable; still show feedback */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const fade = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.18, delay: reduced ? 0 : 0.14 } }, exit: { opacity: 0, transition: { duration: 0.08 } } };

  return (
    <div
      className="pg-modal-root"
      role="dialog"
      aria-modal="true"
      aria-label={`${meta.en} 手感调试`}
      style={{ pointerEvents: present ? undefined : "none" }}
    >
      <motion.div
        className="pg-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.24 } }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
      />
      <motion.div
        ref={boxRef}
        tabIndex={-1}
        layoutId={`card-${id}`}
        className="pg-modal"
        style={{ borderRadius: 16 }}
        transition={springTransition(springs.pop, reduced)}
      >
        <motion.section className="pg-modal-stage" {...fade}>
          <header className="pg-modal-head">
            <div>
              <div className="pg-modal-title">
                {meta.en}
                <span>{meta.name}</span>
              </div>
              <div className="pg-modal-metaphor">特性隐喻：{meta.metaphor}</div>
            </div>
          </header>
          <div className="pg-modal-demo">
            <Demo variant="stage" />
          </div>
          <ul className="pg-hints">
            {hints[id].map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </motion.section>
        <motion.aside className="pg-modal-panel" {...fade}>
          <div className="pg-modal-panel-head">
            <div>
              <div className="pg-modal-panel-title">手感参数</div>
              <div className="pg-modal-panel-sub">
                {nChanged ? `已修改 ${nChanged} 项 · 点击圆点可单项重置` : "拖动标签或滑块，边调边玩"}
              </div>
            </div>
            <button type="button" className="at-icon-btn" aria-label="关闭" onClick={onClose}>
              <IconClose />
            </button>
          </div>
          <div className="pg-modal-panel-body">
            <ParamControls
              schema={schema}
              values={values}
              defaults={defaults}
              onChange={(k, v) => store.setOverride(id, k, v)}
              onReset={(k) => store.resetOverride(id, k)}
            />
            <PanelGroup title="共享参数" badge="跨组件默认值" defaultOpen={false}>
              <div className="pg-shared-note">每项的作用对象见下方说明，修改会同步到对应组件。组件中已单独修改的对应参数不再跟随；重置该项即可恢复共享。</div>
              <ParamControls
                showDescriptions
                schema={sharedSchema}
                values={feel.shared as unknown as Record<string, ParamValue>}
                defaults={feelTokens as unknown as Record<string, ParamValue>}
                onChange={(k, v) => store.setShared(k as keyof SharedFeel, v as number)}
                onReset={(k) => store.resetSharedKey(k as keyof SharedFeel)}
              />
              <ParamControls
                showDescriptions
                schema={springSchema}
                values={feel.springs as unknown as Record<string, ParamValue>}
                defaults={springTokens as unknown as Record<string, ParamValue>}
                onChange={(k, v) => store.setSpring(k as SpringName, v as never)}
                onReset={(k) => store.resetSpringKey(k as SpringName)}
              />
            </PanelGroup>
          </div>
          <div className="pg-modal-panel-foot">
            <Button size="sm" icon={<IconReset />} onClick={() => store.resetComponent(id)} disabled={!nChanged}>
              重置组件参数
            </Button>
            <Button size="sm" variant="primary" icon={copied ? <IconCheck /> : <IconCopy />} onClick={copy}>
              {copied ? "已复制" : "复制 JSON"}
            </Button>
          </div>
        </motion.aside>
      </motion.div>
    </div>
  );
}
