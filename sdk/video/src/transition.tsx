// Transition: how a part comes in and goes out (docs/timeline.feature TL7a). The timeline writes a transition on a
// cut as one <Transition> around what each of the two parts holds: `out` on the part before the cut, `in` on the
// part after it. It plays inside the part's own time (its <Sequence>'s first frames for `in`, its last for `out`),
// so nothing outside the two parts changes and the film is as long as it was.
import type { CSSProperties, ReactNode } from "react";
import { useLocalTime } from "@raea/app/clock";
import { AbsoluteFill } from "./timeline";

/** fade: through black. slide: in from the right, out to the left. wipe: uncovered from the left, covered from the
 *  left. zoom: grows in from 85%, shrinks out to 85%, fading. A dissolve between two parts that only touch has no
 *  frames of the other to mix with, so it is written as a fade. */
export type TransitionKind = "fade" | "slide" | "wipe" | "zoom";
export const TRANSITION_KINDS: TransitionKind[] = ["fade", "slide", "wipe", "zoom"];

export interface TransitionEdge {
  /** which transition: fade, slide, wipe or zoom */
  kind: TransitionKind;
  /** how many of the part's frames it takes */
  frames: number;
}

export interface TransitionProps {
  /** over the part's first frames */
  in?: TransitionEdge;
  /** over the part's last frames */
  out?: TransitionEdge;
  /** the part it brings in and takes out: what the <Sequence> holds */
  children?: ReactNode;
}

/** How far a part is into view: 0 not at all, 1 fully. `frame` is the part's own, `duration` its length. */
export function transitionAt(edge: TransitionEdge | undefined, side: "in" | "out", frame: number, duration: number): number {
  if (!edge || !(edge.frames > 0)) return 1;
  const p = side === "in" ? (frame + 1) / edge.frames : (duration - frame) / edge.frames;
  return Math.min(1, Math.max(0, p));
}

/** The style a kind gives at `p` (0 out of view, 1 in view), on the side it plays. */
export function transitionStyle(kind: TransitionKind, side: "in" | "out", p: number): CSSProperties {
  if (p >= 1) return {};
  // eased out, so it settles
  const e = 1 - (1 - p) * (1 - p);
  if (kind === "slide") return { transform: `translateX(${(side === "in" ? 1 - e : e - 1) * 100}%)` };
  if (kind === "wipe") return { clipPath: side === "in" ? `inset(0 ${(1 - e) * 100}% 0 0)` : `inset(0 0 0 ${(1 - e) * 100}%)` };
  if (kind === "zoom") return { transform: `scale(${0.85 + 0.15 * e})`, opacity: e };
  return { opacity: p };
}

/** Its children, coming in over the part's first frames and going out over its last. */
export function Transition({ in: enter, out: exit, children }: TransitionProps) {
  const t = useLocalTime("Transition");
  for (const [side, edge] of [["in", enter], ["out", exit]] as const) {
    if (!edge) continue;
    if (!TRANSITION_KINDS.includes(edge.kind)) throw new RangeError(`Transition: ${side}.kind is one of ${TRANSITION_KINDS.join(", ")}, got ${String(edge.kind)}`);
    if (!Number.isFinite(edge.frames) || edge.frames < 0) throw new RangeError(`Transition: ${side}.frames must be 0 or more, got ${edge.frames}`);
  }
  const a = enter ? transitionStyle(enter.kind, "in", transitionAt(enter, "in", t.frame, t.duration)) : {};
  const b = exit ? transitionStyle(exit.kind, "out", transitionAt(exit, "out", t.frame, t.duration)) : {};
  // both at once (a part shorter than its two transitions): the moves side by side, the fades multiplied
  const transform = [a.transform, b.transform].filter(Boolean).join(" ") || undefined;
  const opacity = a.opacity === undefined && b.opacity === undefined ? undefined : Number(a.opacity ?? 1) * Number(b.opacity ?? 1);
  const clipPath = a.clipPath ?? b.clipPath;
  if (!transform && opacity === undefined && !clipPath) return <>{children}</>;
  return <AbsoluteFill style={{ ...(transform ? { transform } : {}), ...(opacity !== undefined ? { opacity } : {}), ...(clipPath ? { clipPath } : {}) }}>{children}</AbsoluteFill>;
}
