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

/** The CSS filter of `kind` at `amount` (0 to 1, clamped); undefined for a kind raea doesn't draw. */
export function effectFilter(kind: string, amount = 1): string | undefined {
  const e = EFFECTS.find((x) => x.kind === kind);
  return e?.filter(Math.min(1, Math.max(0, amount)));
}
