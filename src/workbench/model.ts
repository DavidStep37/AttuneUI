import type { Bezier } from "../components/BezierEditor";

export type MotionParam = number | boolean | string | Bezier;
export type MotionParams = Record<string, MotionParam>;
type FieldBase = { key: string; label: string; hint?: string };
export type MotionField = FieldBase & (
  | { type: "number"; default: number; min: number; max: number; step: number; unit?: string; control?: "slider" | "number" }
  | { type: "boolean"; default: boolean }
  | { type: "select"; default: string; options: { value: string; label: string }[] }
  | { type: "bezier"; default: Bezier }
);
export type MotionDefinition = {
  id: string;
  label: string;
  description?: string;
  fields: MotionField[];
  /** Restart only this registered animation; cancel its previous run in the adapter. */
  replay: (params: MotionParams) => void | Promise<void>;
};
export type MotionConfig = {
  schemaVersion: 1;
  projectId: string;
  animations: Record<string, MotionParams>;
};

export function createMotionConfig(projectId: string, definitions: Pick<MotionDefinition, "id" | "fields">[]): MotionConfig {
  if (new Set(definitions.map(d => d.id)).size !== definitions.length) throw new Error("Animation ids must be unique");
  return { schemaVersion: 1, projectId, animations: Object.fromEntries(definitions.map(d => {
    if (new Set(d.fields.map(f => f.key)).size !== d.fields.length) throw new Error(`Duplicate fields: ${d.id}`);
    return [d.id, Object.fromEntries(d.fields.map(f => [f.key, Array.isArray(f.default) ? [...f.default] : f.default]))];
  })) };
}

/** Stable, complete snapshot; callbacks and panel position never enter the motion config. */
export function serializeMotionConfig(config: MotionConfig, definitions: MotionDefinition[]) {
  return JSON.stringify({ ...config, animations: Object.fromEntries(definitions.map(d => [d.id, {
    label: d.label,
    parameters: config.animations[d.id],
    units: Object.fromEntries(d.fields.filter(f => f.type === "number" && f.unit).map(f => [f.key, f.type === "number" ? f.unit : undefined])),
  }])) }, null, 2);
}

export type Point = { x: number; y: number };
export type Anchor = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
export const anchors: Anchor[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
export const clampPoint = (p: Point, w: number, h: number, viewport: Point): Point => ({
  x: Math.max(12, Math.min(Math.max(12, viewport.x - w - 12), p.x)),
  y: Math.max(12, Math.min(Math.max(12, viewport.y - h - 12), p.y)),
});
export function anchorPoint(anchor: Anchor, w: number, h: number, viewport: Point): Point {
  return clampPoint({ x: anchor.endsWith("left") ? 12 : anchor.endsWith("right") ? viewport.x - w - 12 : (viewport.x - w) / 2,
    y: anchor.startsWith("top") ? 12 : viewport.y - h - 12 }, w, h, viewport);
}
export function nearestAnchor(p: Point, w: number, h: number, viewport: Point): Anchor {
  return anchors.reduce((best, next) => {
    const a = anchorPoint(best, w, h, viewport), b = anchorPoint(next, w, h, viewport);
    return Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(p.x - a.x, p.y - a.y) ? next : best;
  });
}
