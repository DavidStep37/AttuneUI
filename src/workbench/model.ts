/**
 * Data contract for the motion workbench. Dependency-free on purpose: the "custom UI" install
 * mode ships only this file, so an agent can draw its own panel and still produce the same JSON
 * and token behaviour.
 */
/** cubic-bezier control points [x1, y1, x2, y2]; structurally identical to AttuneUI's Bezier. */
export type Bezier = [number, number, number, number];

export type MotionParam = number | boolean | string | Bezier;
export type MotionParams = Record<string, MotionParam>;
type FieldBase = { key: string; label: string; hint?: string };
export type MotionField = FieldBase & (
  /** `token`: match design tokens by name/group (e.g. "Duration/short"); otherwise matched by unit (ms/s → durations, px → distances). */
  | { type: "number"; default: number; min: number; max: number; step: number; unit?: string; control?: "slider" | "number"; token?: string }
  | { type: "boolean"; default: boolean }
  | { type: "select"; default: string; options: { value: string; label: string }[] }
  /** Bezier fields use easing tokens as their presets; `token` narrows which ones. */
  | { type: "bezier"; default: Bezier; token?: string }
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

/**
 * Stable, complete snapshot; callbacks and panel position never enter the motion config.
 * With a token set loaded, `tokenSet` names it and each group lists which parameters sit exactly
 * on a token (`tokens: { duration: "Duration/short-3" }`), so the result can be written back as tokens.
 */
export function serializeMotionConfig(config: MotionConfig, definitions: MotionDefinition[], tokenSet?: MotionTokenSet | null) {
  return JSON.stringify({ ...config, ...(tokenSet ? { tokenSet: tokenSet.name } : {}), animations: Object.fromEntries(definitions.map(d => {
    const params = config.animations[d.id];
    const tokens = tokenSet ? Object.fromEntries(d.fields.flatMap(f => {
      const name = tokenNameFor(f, params[f.key], tokenSet);
      return name ? [[f.key, name]] : [];
    })) : null;
    return [d.id, {
      label: d.label,
      parameters: params,
      units: Object.fromEntries(d.fields.filter(f => f.type === "number" && f.unit).map(f => [f.key, f.type === "number" ? f.unit : undefined])),
      ...(tokens && Object.keys(tokens).length ? { tokens } : {}),
    }];
  })) }, null, 2);
}

/* ---------------------------------------------------------------- tokens */

export type MotionTokenKind = "duration" | "distance" | "easing" | "number";
export type MotionToken = {
  /** Full path, e.g. "Duration/short-1" — what gets exported. */
  name: string;
  /** Short display name, e.g. "short-1" or a description such as "通用加速". */
  label: string;
  kind: MotionTokenKind;
  /** durations in ms, distances in px, easings as cubic-bezier points */
  value: number | Bezier;
};
export type MotionTokenSet = { name: string; tokens: MotionToken[] };
/** A token value converted to a field's unit, ready to become a slider mark or a curve preset. */
export type FieldToken = { name: string; label: string; value: number | Bezier };

const KEYWORD_EASINGS: Record<string, Bezier> = {
  linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], "ease-in": [0.42, 0, 1, 1], "ease-out": [0, 0, 0.58, 1], "ease-in-out": [0.42, 0, 0.58, 1],
};
const isCurve = (v: unknown): v is Bezier => Array.isArray(v) && v.length === 4 && v.every(n => typeof n === "number" && Number.isFinite(n));

/** One raw token value → kind + normalized value, or null when it isn't a motion value. */
function readToken(raw: unknown, type: string | undefined, path: string): Pick<MotionToken, "kind" | "value"> | null {
  const hint = `${type ?? ""} ${path}`.toLowerCase();
  if (isCurve(raw)) return { kind: "easing", value: [...raw] as Bezier };
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (/duration|delay|time/.test(hint)) return { kind: "duration", value: raw };
    if (/dimension|distance|offset|spacing|size/.test(hint)) return { kind: "distance", value: raw };
    return { kind: "number", value: raw };
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim().toLowerCase();
  if (KEYWORD_EASINGS[text]) return { kind: "easing", value: [...KEYWORD_EASINGS[text]] as Bezier };
  const curve = text.replace(/^cubic-bezier\(|\)$/g, "").replace(/^\(|\)$/g, "").split(/[\s,，]+/).filter(Boolean).map(Number);
  if (curve.length === 4 && curve.every(Number.isFinite)) return { kind: "easing", value: curve as Bezier };
  const m = text.match(/^(-?\d*\.?\d+)\s*(ms|s|px|rem)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === "ms") return { kind: "duration", value: n };
  if (m[2] === "s") return { kind: "duration", value: Math.round(n * 1000 * 1000) / 1000 };
  if (m[2] === "px") return { kind: "distance", value: n };
  if (m[2] === "rem") return { kind: "distance", value: n * 16 };
  return readToken(n, type, path);
}

/**
 * Accepts the shapes design teams usually export, and throws a readable error otherwise:
 * - nested groups `{ "Duration": { "short-1": "100ms" } }` or slash paths `{ "Duration/short-1": "100ms" }`
 * - W3C design tokens `{ "$value": "100ms", "$type": "duration", "$description": "…" }`
 * - easings as `[x1,y1,x2,y2]`, `"cubic-bezier(…)"`, `"0.32, 0, 0.67, 0"` or CSS keywords
 * - this tool's own `{ name, tokens: [{ name, kind, value }] }`
 */
export function parseMotionTokens(input: unknown, fallbackName = "Motion Token"): MotionTokenSet {
  let data = input;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { throw new Error("不是有效的 JSON，请检查括号、逗号和引号。"); }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Token 文件应是一个 JSON 对象。");
  const root = data as Record<string, unknown>;
  const name = typeof root.name === "string" ? root.name : typeof root.$name === "string" ? root.$name : fallbackName;
  const tokens: MotionToken[] = [];
  const push = (path: string, raw: unknown, type?: string, description?: unknown) => {
    const read = readToken(raw, type, path);
    if (!read) return;
    const parts = path.split("/");
    // "Duration/short/1" reads better as "short-1" than "1".
    const last = /^\d+$/.test(parts.at(-1) ?? "") && parts.length > 1 ? `${parts.at(-2)}-${parts.at(-1)}` : parts.at(-1) ?? path;
    tokens.push({ name: path, label: typeof description === "string" && description.trim() ? description.trim() : last, ...read });
  };
  if (Array.isArray(root.tokens)) {
    for (const t of root.tokens as Record<string, unknown>[]) if (t && typeof t.name === "string") push(t.name, t.value, typeof t.kind === "string" ? t.kind : undefined, t.label);
  } else {
    const walk = (node: unknown, path: string[], inherited?: string) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) { if (path.length) push(path.join("/"), node, inherited); return; }
      const obj = node as Record<string, unknown>;
      const type = typeof obj.$type === "string" ? obj.$type : inherited;
      if ("$value" in obj) { push(path.join("/"), obj.$value, type, obj.$description ?? obj.description); return; }
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("$") || (path.length === 0 && key === "name")) continue;
        walk(value, [...path, ...key.split("/").filter(Boolean)], type);
      }
    };
    walk(root, []);
  }
  if (!tokens.length) throw new Error("没有识别到动效 token：需要时长（如 \"200ms\"）、距离（如 \"8px\"）或缓动曲线（如 [0.2, 0, 0, 1]）。");
  return { name, tokens };
}

const matches = (token: MotionToken, query: string) => token.name.toLowerCase().includes(query.toLowerCase());

/**
 * Tokens that apply to a field, converted to its unit and range, sorted, one per value.
 * Number fields: explicit `token` query, else by unit (ms/s → duration, px → distance). Needs two or
 * more in range to become a segmented slider. Bezier fields: easing tokens become the presets.
 */
export function tokensForField(field: MotionField, set: MotionTokenSet | null | undefined): FieldToken[] {
  if (!set) return [];
  const query = field.type === "number" || field.type === "bezier" ? field.token : undefined;
  if (field.type === "bezier") {
    return set.tokens.filter(t => t.kind === "easing" && (!query || matches(t, query))).map(t => ({ name: t.name, label: t.label, value: t.value }));
  }
  if (field.type !== "number") return [];
  const unit = field.unit?.toLowerCase();
  const kind: MotionTokenKind | null = query ? null : unit === "ms" || unit === "s" ? "duration" : unit === "px" ? "distance" : null;
  if (!query && !kind) return [];
  const seen = new Set<number>();
  const list = set.tokens
    .filter(t => typeof t.value === "number" && (query ? matches(t, query) : t.kind === kind))
    .map(t => ({ name: t.name, label: t.label, value: t.kind === "duration" && unit === "s" ? (t.value as number) / 1000 : (t.value as number) }))
    .filter(t => (t.value as number) >= field.min && (t.value as number) <= field.max && !seen.has(t.value as number) && (seen.add(t.value as number), true))
    .sort((a, b) => (a.value as number) - (b.value as number));
  // "None" (0 ms delay, 0 px offset) is always a valid stop when the field allows it, even though
  // token tables rarely list it. It has no token name, so it is never exported as a token.
  if (list.length && field.min <= 0 && field.max >= 0 && !seen.has(0)) list.unshift({ name: "", label: "无", value: 0 });
  return list;
}

/** Name of the token the value sits on exactly, if any. */
export function tokenNameFor(field: MotionField, value: MotionParam, set: MotionTokenSet | null | undefined): string | undefined {
  const list = tokensForField(field, set);
  if (field.type === "number" && list.length < 2) return undefined;
  return list.find(t => t.name && (Array.isArray(t.value) ? Array.isArray(value) && t.value.every((n, i) => Math.abs(n - (value as Bezier)[i]) < 1e-6) : t.value === value))?.name || undefined;
}

/** Snap every segmented number field onto its nearest token; curves are left as they are. */
export function snapConfigToTokens(config: MotionConfig, definitions: Pick<MotionDefinition, "id" | "fields">[], set: MotionTokenSet): { config: MotionConfig; snapped: number; segmented: number } {
  let snapped = 0, segmented = 0;
  const animations = Object.fromEntries(definitions.map(d => [d.id, Object.fromEntries(d.fields.map(f => {
    const value = config.animations[d.id][f.key];
    const list = f.type === "number" && f.control !== "number" ? tokensForField(f, set) : [];
    if (list.length < 2) return [f.key, value];
    segmented++;
    const nearest = list.reduce((a, b) => Math.abs((b.value as number) - (value as number)) < Math.abs((a.value as number) - (value as number)) ? b : a);
    if (nearest.value !== value) snapped++;
    return [f.key, nearest.value];
  }))]));
  return { config: { ...config, animations }, snapped, segmented };
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
