// Nudge: a part placed by hand on raea's picture (docs/editing.feature, E1). The editor writes a moved, scaled, turned
// or faded part back to the composition as one <Nudge x y scale rotate opacity> around the element that holds it (the
// timeline also writes mirror and crop, docs/timeline.feature TL3h); the
// next change to the same part re-writes that line.
import { cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useCurrentFrame } from "@raea/app/clock";
import { Easing } from "@raea/math/easing";
import { AbsoluteFill } from "./timeline";

/** A property's value at a frame, and how it leaves for the next key: a straight line (the default), no travel
 *  ("hold": it stays, then jumps), or a cubic bezier's two handles [x1, y1, x2, y2] as CSS writes them. The timeline
 *  writes these (docs/timeline.feature TL5d). */
export type NudgeKey = [frame: number, value: number, ease?: "linear" | "hold" | [number, number, number, number]];
export type NudgeProp = "x" | "y" | "scale" | "rotate" | "opacity";

/** A keyed property's value at `frame`: before its first key and after its last it holds; between two it follows
 *  the first one's ease. */
export function keyedAt(keys: NudgeKey[], frame: number): number {
  const ks = [...keys].sort((a, b) => a[0] - b[0]);
  if (frame <= ks[0][0]) return ks[0][1];
  const last = ks[ks.length - 1];
  if (frame >= last[0]) return last[1];
  const i = ks.findIndex((k) => k[0] > frame) - 1;
  const [f0, v0, ease] = ks[i];
  const [f1, v1] = ks[i + 1];
  const p = (frame - f0) / (f1 - f0);
  const k = ease === "hold" ? 0 : Array.isArray(ease) ? Easing.bezier(...ease)(p) : p;
  return v0 + (v1 - v0) * k;
}

export interface NudgeProps {
  /** how far to move it, in the composition's pixels */
  x?: number;
  /** how far to move it down, in the composition's pixels */
  y?: number;
  /** how much bigger (2) or smaller (0.5), about its centre */
  scale?: number;
  /** a turn, in degrees, about its centre */
  rotate?: number;
  /** 0 (gone) to 1 (as it was), times its own opacity */
  opacity?: number;
  /** flipped left to right */
  mirror?: boolean;
  /** how much is cut off its left, top, right and bottom, each a share of that side from 0 to 0.9 */
  crop?: [left: number, top: number, right: number, bottom: number];
  /** any of the above over time: its keys, each [frame, value, ease?], in frames from where this part's time starts
   *  (its <Sequence>'s first frame). A keyed property's still value is ignored. */
  keys?: Partial<Record<NudgeProp, NudgeKey[]>>;
  /** the part it places: an element, or a component, which moves inside a full-frame layer */
  children?: ReactNode;
}

/** Places its child: an element gets the move in front of its own transform and the fade times its own opacity; a
 *  component, whose box it can't reach, is placed inside a full-frame layer. */
export function Nudge({ keys, ...still }: NudgeProps) {
  // keyed: the frame is read where the keys are (a hook, so in a component of its own), and the values placed as still ones
  return keys && Object.values(keys).some((k) => k?.length) ? <Keyed keys={keys} {...still} /> : <Placed {...still} />;
}

function Keyed({ keys, children, ...still }: NudgeProps & { keys: NonNullable<NudgeProps["keys"]> }) {
  const frame = useCurrentFrame();
  const now: Partial<Record<NudgeProp, number>> = {};
  for (const [prop, ks] of Object.entries(keys) as [NudgeProp, NudgeKey[] | undefined][]) if (ks?.length) now[prop] = keyedAt(ks, frame);
  return <Placed {...still} {...now}>{children}</Placed>;
}

function Placed({ x = 0, y = 0, scale = 1, rotate = 0, opacity = 1, mirror = false, crop, children }: Omit<NudgeProps, "keys">) {
  for (const [k, v] of Object.entries({ x, y, scale, rotate, opacity }))
    if (!Number.isFinite(v)) throw new RangeError(`Nudge: ${k} must be a finite number, got ${v}`);
  if (scale <= 0) throw new RangeError(`Nudge: scale must be above 0, got ${scale}`);
  const fade = Math.min(1, Math.max(0, opacity));
  const move = [
    (x || y) && `translate(${x}px, ${y}px)`,
    rotate && `rotate(${rotate}deg)`,
    (scale !== 1 || mirror) && (mirror ? `scale(${-scale}, ${scale})` : `scale(${scale})`),
  ].filter(Boolean).join(" ") || undefined;
  if (crop !== undefined && (!Array.isArray(crop) || crop.length !== 4 || crop.some((v) => !(v >= 0 && v <= 0.9)))) throw new RangeError(`Nudge: crop is [left, top, right, bottom], each from 0 to 0.9, got ${JSON.stringify(crop)}`);
  // (inset's order is top, right, bottom, left)
  const cut = crop?.some((v) => v > 0) ? `inset(${crop[1] * 100}% ${crop[2] * 100}% ${crop[3] * 100}% ${crop[0] * 100}%)` : undefined;
  if (isValidElement(children) && typeof children.type === "string") {
    const style = ((children.props as { style?: CSSProperties }).style ?? {}) as CSSProperties;
    const own = typeof style.opacity === "number" ? style.opacity : style.opacity === undefined ? 1 : Number(style.opacity);
    return cloneElement(children as ReactElement<{ style?: CSSProperties }>, {
      style: {
        ...style,
        ...(move ? { transform: style.transform ? `${move} ${style.transform}` : move } : {}),
        ...(fade !== 1 ? { opacity: own * fade } : {}),
        ...(cut ? { clipPath: cut } : {}),
      },
    });
  }
  return <AbsoluteFill style={{ ...(move ? { transform: move } : {}), ...(fade !== 1 ? { opacity: fade } : {}), ...(cut ? { clipPath: cut } : {}) }}>{children}</AbsoluteFill>;
}
