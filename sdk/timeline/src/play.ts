// Playing an edited timeline of footage without rendering it (docs/timeline.feature TL10a, for a film's own
// frames): which source frame shows at a timeline frame, where the player goes when a clip ends, and which
// timeline ranges are ready given the source ranges that are (the player's buffer). The main track is the picture.
import type { Range } from "./cache"
import { joined } from "./cache"
import { type Clip, end, type Frames, speedOf, type Timeline } from "./model"
import { played, sourceAt as curveAt } from "./speed"

const main = (t: Timeline): Clip[] => (t.tracks.find((k) => k.kind === "main" && !k.hidden)?.clips ?? []).filter((c) => !c.off && c.in !== undefined).sort((a, b) => a.start - b.start)

export interface Showing {
  clip: Clip
  /** the source frame to show */
  source: number
  /** how fast the source runs there (the player's rate) */
  rate: number
}

/** What shows at timeline frame `frame`: the main-track clip over it, the source frame, and the rate. Undefined
 *  in a gap or past the end. */
export function showing(t: Timeline, frame: Frames): Showing | undefined {
  const c = main(t).find((x) => x.start <= frame && frame < end(x))
  if (!c) return undefined
  const into = frame - c.start
  if (c.curve) {
    const span = c.shows ?? c.length / played(c.curve, 1)
    const at = curveAt(c.curve, span, into)
    // the rate at that place: the source covered by the next frame
    return { clip: c, source: c.in! + at, rate: Math.max(0.1, curveAt(c.curve, span, into + 1) - at) }
  }
  return { clip: c, source: c.in! + into * speedOf(c), rate: speedOf(c) }
}

/** The timeline frame at which clip `id` shows source frame `source`, when it does (a constant-speed clip). */
export function frameOf(t: Timeline, id: string, source: number): Frames | undefined {
  const c = main(t).find((x) => x.id === id)
  if (!c || c.curve) return undefined
  const f = c.start + (source - c.in!) / speedOf(c)
  return f >= c.start - 0.5 && f < end(c) + 0.5 ? Math.min(end(c), Math.max(c.start, f)) : undefined
}

/** Where the player goes when what it is playing ends at timeline frame `frame`: the next clip's first frame (at
 *  or after it), or undefined at the film's end. */
export function next(t: Timeline, frame: Frames): Frames | undefined {
  return main(t).find((x) => x.start >= frame)?.start
}

/** The timeline's length as it plays: its main track's end. */
export const playLength = (t: Timeline): Frames => Math.max(0, ...main(t).map(end))

/** The timeline ranges that are ready to play, given the source ranges that are (frames of the file the player has
 *  buffered): each main-track clip's part whose source is in one of them. */
export function ready(t: Timeline, source: Range[]): Range[] {
  const out: Range[] = []
  for (const c of main(t)) {
    if (c.curve) continue
    const rate = speedOf(c), from = c.in!, to = c.in! + c.length * rate
    for (const [a, b] of source) {
      const lo = Math.max(a, from), hi = Math.min(b, to)
      if (hi > lo) out.push([Math.floor(c.start + (lo - from) / rate), Math.ceil(c.start + (hi - from) / rate)])
    }
  }
  return joined(out)
}
