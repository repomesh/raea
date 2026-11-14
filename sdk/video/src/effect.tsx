// Effect: a look put on everything drawn under it (docs/timeline.feature TL7b). The timeline writes an effect clip
// as an <Effect> in a <Sequence> of its own after the parts it covers, so it is on for that sequence's frames and
// moved, trimmed, split and deleted like any other clip. It draws nothing itself: it filters what is behind it.
import { useLocalTime } from "@raea/app/clock";
import { AbsoluteFill } from "./timeline";
import { EFFECTS, effectFilter, effectPartsError, partsFilter, type EffectPart } from "./effects";

export interface EffectProps {
  /** which effect: blur, mono, sepia, vivid, faded, contrast, bright, dark, invert or hue; with `parts`, its own name */
  kind: string;
  /** an effect of its own, as CSS filter functions (a plugin's): each [function, value at amount 0, value at
   *  amount 1, unit], such as [["blur", 0, 6, "px"], ["saturate", 1, 1.6]] */
  parts?: EffectPart[];
  /** how much of it, from 0 (none) to 1 (all, the default) */
  amount?: number;
  /** frames it takes to come on at its part's start (0: on at once) */
  in?: number;
  /** frames it takes to go off by its part's end (0: off at once) */
  out?: number;
}

/** How much of the effect is on at `frame` of a part `duration` frames long, coming on over `enter` and off over `exit`. */
export function effectAt(frame: number, duration: number, enter = 0, exit = 0): number {
  const a = enter > 0 ? (frame + 1) / enter : 1;
  const b = exit > 0 && Number.isFinite(duration) ? (duration - frame) / exit : 1;
  return Math.min(1, Math.max(0, Math.min(a, b)));
}

/** The picture under it, through the effect, for as long as its <Sequence> runs. */
export function Effect({ kind, parts, amount = 1, in: enter = 0, out: exit = 0 }: EffectProps) {
  const t = useLocalTime("Effect");
  if (parts !== undefined) {
    const why = effectPartsError(parts);
    if (why) throw new RangeError(`Effect ${kind}: ${why}`);
  } else if (!EFFECTS.some((e) => e.kind === kind)) throw new RangeError(`Effect: kind is one of ${EFFECTS.map((e) => e.kind).join(", ")} (or give its parts), got ${String(kind)}`);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) throw new RangeError(`Effect ${kind}: amount runs from 0 to 1, got ${amount}`);
  for (const [name, v] of [["in", enter], ["out", exit]] as const) if (!Number.isFinite(v) || v < 0) throw new RangeError(`Effect ${kind}: ${name} must be 0 or more frames, got ${v}`);
  const on = amount * effectAt(t.frame, t.duration, enter, exit);
  const filter = parts ? partsFilter(parts, on) : effectFilter(kind, on);
  return <AbsoluteFill data-effect={kind} style={{ backdropFilter: filter, pointerEvents: "none" }} />;
}
