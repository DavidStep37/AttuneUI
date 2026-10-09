import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, TriangleAlert, CircleX } from "lucide-react";
import { useFeel } from "../core/feel";
import { useLatest } from "../core/hooks";
import { IconClose } from "../core/icons";
import type { ResolvedFeel } from "../core/schema";
import { useAttuneScope } from "../core/surface";

export type DismissReason = "manual" | "auto";
export type FeedbackProps = {
  open: boolean;
  onDismiss: (reason: DismissReason) => void;
  children: ReactNode;
  title?: ReactNode;
  tone?: "info" | "success" | "warning" | "error";
  /** 0 keeps the feedback open until dismissed. Alert defaults to 0. */
  duration?: number;
  dismissible?: boolean;
  feel?: Partial<ResolvedFeel<"feedback">>;
};

function Feedback({ open, onDismiss, children, title, tone = "info", duration, dismissible = true, feel: local, kind }: FeedbackProps & { kind: "alert" | "message" | "toast" }) {
  const scope = useAttuneScope();
  const { p, t, reduced, deform } = useFeel("feedback", local);
  const [reason, setReason] = useState<DismissReason>("auto");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(0);
  const callback = useLatest(onDismiss);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dismissed = useRef(false);
  const delay = duration ?? (kind === "alert" ? 0 : p.duration);
  const dismiss = useCallback((why: DismissReason) => {
    if (dismissed.current) return;
    dismissed.current = true;
    setReason(why);
    callback.current(why);
  }, [callback]);

  useEffect(() => {
    remaining.current = delay;
    if (open) {
      dismissed.current = false;
      setReason("auto");
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else { setHovered(false); setFocused(false); }
  }, [open, delay]);
  useEffect(() => {
    if (!open || delay <= 0 || hovered || focused) return;
    const started = performance.now();
    const timer = setTimeout(() => dismiss("auto"), Math.max(0, remaining.current));
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (performance.now() - started)); };
  }, [open, delay, hovered, focused, dismiss]);

  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? TriangleAlert : tone === "error" ? CircleX : Info;
  const content = <AnimatePresence custom={reason} onExitComplete={() => {
    if (document.activeElement === document.body && returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
  }}>
    {open && <motion.div key="feedback" className={`at-feedback at-feedback-${kind}`} data-tone={tone} data-at-interactive
      role={tone === "error" || tone === "warning" ? "alert" : "status"} aria-atomic="true"
      custom={reason} initial="enter" animate="visible" exit="exit"
      variants={{
        enter: { opacity: 0, y: reduced ? 0 : p.enterOffset, scaleX: reduced ? 1 : 0.96, scaleY: reduced ? 1 : 0.9, filter: "blur(0px)" },
        visible: { opacity: 1, y: 0, scaleX: 1, scaleY: 1, filter: "blur(0px)", transition: t(p.enterSpring) },
        exit: (why: DismissReason) => ({ opacity: 0, y: 0,
          scaleX: !reduced && why === "manual" ? 1 + (p.dismissScale - 1) * deform : 1,
          scaleY: !reduced && why === "manual" ? 1 + (p.dismissScale - 1) * deform : 1,
          filter: `blur(${reduced ? 0 : p.exitBlur}px)`,
          transition: { duration: reduced ? 0 : p.exitDuration / 1000, ease: "easeOut" },
        }),
      }}
      onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
      <Icon className="at-feedback-icon" size={16} strokeWidth={1.75} aria-hidden />
      <div className="at-feedback-copy">{title && <strong>{title}</strong>}<div>{children}</div></div>
      {dismissible && <button className="at-icon-btn at-feedback-close" type="button" aria-label="关闭提示" onClick={() => dismiss("manual")}><IconClose /></button>}
    </motion.div>}
  </AnimatePresence>;
  return kind === "toast" ? typeof document === "undefined" ? null : createPortal(<div {...scope} className="at-root at-toast-viewport">{content}</div>, document.body) : content;
}

export function Alert(props: FeedbackProps) { return <Feedback {...props} kind="alert" />; }
export function Message(props: FeedbackProps) { return <Feedback {...props} kind="message" />; }
export function Toast(props: FeedbackProps) { return <Feedback {...props} kind="toast" />; }
