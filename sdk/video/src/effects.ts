// The effects a clip of its own puts on the picture under it (docs/timeline.feature TL7b), as data: each a CSS
// filter at an amount from 0 (none) to 1 (all of it). One table, so the engine's <Effect> and the timeline's
// preview of an effect on a film draw the same thing.
export interface EffectKind {
  /** its name in the composition's code: <Effect kind> */
  kind: string;
  /** what the person sees */
  title: string;
  /** the CSS filter at `amount` */
  filter: (amount: number) => string;
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);

export const EFFECTS: EffectKind[] = [
  { kind: "blur", title: "Blur", filter: (a) => `blur(${n(a * 24)}px)` },
  { kind: "mono", title: "Black and white", filter: (a) => `grayscale(${n(a)})` },
  { kind: "sepia", title: "Sepia", filter: (a) => `sepia(${n(a)})` },
  { kind: "vivid", title: "Vivid", filter: (a) => `saturate(${n(1 + a * 1.5)}) contrast(${n(1 + a * 0.15)})` },
  { kind: "faded", title: "Faded", filter: (a) => `saturate(${n(1 - a * 0.6)}) contrast(${n(1 - a * 0.25)}) brightness(${n(1 + a * 0.08)})` },
  { kind: "contrast", title: "Contrast", filter: (a) => `contrast(${n(1 + a)})` },
  { kind: "bright", title: "Brighten", filter: (a) => `brightness(${n(1 + a * 0.6)})` },
  { kind: "dark", title: "Darken", filter: (a) => `brightness(${n(1 - a * 0.6)})` },
  { kind: "invert", title: "Invert", filter: (a) => `invert(${n(a)})` },
  { kind: "hue", title: "Hue shift", filter: (a) => `hue-rotate(${n(a * 180)}deg)` },
];

/** An effect as data (a plugin's, docs/timeline.feature TL11a): each part one CSS filter function, its value going
 *  from `from` (amount 0, where it changes nothing) to `to` (amount 1), with its unit: ["blur", 0, 6, "px"]. */
export type EffectPart = [fn: string, from: number, to: number, unit?: string];

/** The filter functions a part may name, each with the units it takes. */
export const EFFECT_FNS: Record<string, string[]> = {
  blur: ["px"],
  brightness: [""],
  contrast: [""],
  grayscale: [""],
  "hue-rotate": ["deg"],
  invert: [""],
  saturate: [""],
  sepia: [""],
};

/** Why `parts` isn't an effect's parts, or undefined when it is. */
export function effectPartsError(parts: unknown): string | undefined {
  if (!Array.isArray(parts) || !parts.length || parts.length > 8) return "parts is one to eight [function, from, to, unit] entries";
  for (const p of parts) {
    if (!Array.isArray(p) || typeof p[0] !== "string" || !(p[0] in EFFECT_FNS)) return `a part's function is one of ${Object.keys(EFFECT_FNS).join(", ")}`;
    if (typeof p[1] !== "number" || typeof p[2] !== "number" || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) return `${p[0]}: from and to are numbers`;
    if (!EFFECT_FNS[p[0]].includes(p[3] ?? "")) return `${p[0]} takes ${EFFECT_FNS[p[0]].map((u) => u || "no unit").join(" or ")}`;
  }
  return undefined;
}

/** The CSS filter of an effect given as parts, at `amount` (0 to 1, clamped). */
export function partsFilter(parts: EffectPart[], amount = 1): string {
  const a = Math.min(1, Math.max(0, amount));
  return parts.map(([fn, from, to, unit = ""]) => `${fn}(${n(from + (to - from) * a)}${unit})`).join(" ");
}

/** The CSS filter of `kind` at `amount` (0 to 1, clamped); undefined for a kind raea doesn't draw. */
export function effectFilter(kind: string, amount = 1): string | undefined {
  const e = EFFECTS.find((x) => x.kind === kind);
  return e?.filter(Math.min(1, Math.max(0, amount)));
}
