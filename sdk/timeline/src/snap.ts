// What an edge snaps to (docs/timeline.feature TL4b): clip edges on every track, the playhead, markers, a sound's
// beats and the film's ends. (The main track's magnet is the operations' own: ops.ts settles it.)
import { type Clip, end, type Frames, type Timeline, type Track } from "./model"

export interface Target {
  at: Frames
  /** what is there, for the line drawn where it snapped */
  what: "clip" | "playhead" | "marker" | "beat" | "start"
}

/** Every frame an edge can snap to, leaving out the clips being moved (`not`). */
export function targets(t: Timeline, o: { not?: string[]; playhead?: Frames; beats?: Frames[] } = {}): Target[] {
  const skip = new Set(o.not ?? [])
  const out: Target[] = [{ at: 0, what: "start" }]
  for (const k of t.tracks)
    for (const c of k.clips) {
      if (skip.has(c.id)) continue
      out.push({ at: c.start, what: "clip" }, { at: end(c), what: "clip" })
      for (const m of c.markers ?? []) out.push({ at: c.start + m.at, what: "marker" })
    }
  for (const m of t.markers) out.push({ at: m.at, what: "marker" })
  for (const b of o.beats ?? []) out.push({ at: b, what: "beat" })
  if (o.playhead !== undefined) out.push({ at: o.playhead, what: "playhead" })
  return out
}

/** `frame` moved to the nearest target within `within` frames (8 px at the strip's zoom), and what it snapped to. */
export function snap(frame: Frames, to: Target[], within: Frames): { frame: Frames; to?: Target } {
  let best: Target | undefined
  for (const x of to) if (Math.abs(x.at - frame) <= within && (!best || Math.abs(x.at - frame) < Math.abs(best.at - frame))) best = x
  return best ? { frame: best.at, to: best } : { frame: Math.round(frame) }
}

/** A moved clip (its start and length) snapped by whichever of its edges is nearer a target: how far it moves. */
export function snapMove(start: Frames, len: Frames, to: Target[], within: Frames): { by: Frames; to?: Target } {
  const a = snap(start, to, within), b = snap(start + len, to, within)
  if (a.to && (!b.to || Math.abs(a.frame - start) <= Math.abs(b.frame - (start + len)))) return { by: a.frame - start, to: a.to }
  if (b.to) return { by: b.frame - (start + len), to: b.to }
  return { by: 0 }
}

/** Whether `c` has room on the track (it overlaps none of the others). */
export const fits = (track: Track, c: Pick<Clip, "id" | "start" | "length">): boolean => track.clips.every((o) => o.id === c.id || o.start >= c.start + c.length || end(o) <= c.start)
