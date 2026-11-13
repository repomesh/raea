// A timeline read from what is there (docs/timeline.feature TL0c, TL14a): a composition's sequences as the host
// lists them (raea-feed host/sequences.ts), or a film with no composition as its scenes and its sound. And an
// operation on a sequences' timeline as the host's own edits to those elements (docs/editing.feature E3b), until
// every operation is a code edit of its own (edits.ts).
import { type Clip, empty, end, find, type Frames, type Timeline, type Track } from "./model"
import type { Op } from "./ops"

/** A <Sequence> as the host lists it: its place among the file's elements, its span in the composition's frames,
 *  the lane it sits on (nested ones below their parent, overlapping ones apart), and why it can't be rewritten. */
export interface SeqRow {
  i: number
  name: string
  label?: string
  from: number
  to: number
  lane: number
  locked?: string
}
/** The host's edit to a sequence: its new span, a split, a delete. */
export type SeqEdit = { op: "move"; i: number; from: number; to: number } | { op: "split"; i: number; at: number } | { op: "delete"; i: number }

const seqId = (i: number) => `seq-${i}`
const seqOf = (id: string): number | undefined => (/^seq-\d+$/.test(id) ? Number(id.slice(4)) : undefined)

/** The composition's sequences as a timeline: a track a lane, the first lane on top as the strip draws it. The first
 *  lane is the main track, its magnet on, only when its clips already run from frame 0 with no gap: a composition's
 *  sequences are where its code puts them, and nothing here moves one that wasn't dragged. */
export function fromSequences(rows: SeqRow[], fps: number): Timeline {
  const lanes = [...new Set(rows.map((r) => r.lane))].sort((a, b) => a - b)
  const clipsOf = (lane: number): Clip[] => rows.filter((r) => r.lane === lane).sort((a, b) => a.from - b.from).map((r) => ({ id: seqId(r.i), kind: "sequence", name: r.label ?? r.name, start: r.from, length: Math.max(1, r.to - r.from), ...(r.locked && { locked: r.locked }) }))
  const first = lanes.length ? clipsOf(lanes[0]) : []
  const gapless = first.length > 0 && first.every((c, n) => c.start === (n ? end(first[n - 1]) : 0))
  const tracks: Track[] = lanes.map((lane, n) => ({ id: n === 0 && gapless ? "main" : `overlay-${lane}`, kind: n === 0 && gapless ? "main" : "overlay", clips: clipsOf(lane) }))
  // lanes below the first are nested deeper: drawn under it, as the strip has them
  return { ...empty(fps), tracks, magnet: gapless }
}

/** A film with no composition behind it: its scenes as clips of one main track (cut where the picture cuts), and
 *  its sound as one clip under them. Its magnet is on: a scene removed closes up, as a cut of footage does. */
export function fromRender(o: { frames: Frames; fps: number; cuts?: Frames[]; sound?: boolean }): Timeline {
  const edges = [0, ...[...new Set(o.cuts ?? [])].filter((c) => c > 0 && c < o.frames).sort((a, b) => a - b), o.frames]
  const scenes: Clip[] = edges.slice(0, -1).map((from, n) => ({ id: `scene-${n + 1}`, kind: "video", name: `Scene ${n + 1}`, start: from, length: edges[n + 1] - from, in: from, source: o.frames }))
  const tracks: Track[] = [{ id: "main", kind: "main", clips: scenes }]
  if (o.sound) tracks.push({ id: "sound-1", kind: "sound", clips: [{ id: "sound", kind: "audio", name: "Sound", start: 0, length: o.frames, in: 0, source: o.frames }] })
  return { ...empty(o.fps), tracks }
}

/** A render's cut, as the frames of the source played in order (the hand edit's `segments`): what a film's main
 *  track is after its scenes were moved, trimmed, split and removed. */
export function segmentsOf(t: Timeline): [Frames, Frames][] {
  const main = t.tracks.find((k) => k.kind === "main")
  return (main?.clips ?? []).filter((c) => !c.off && c.in !== undefined).map((c) => [c.in!, c.in! + c.length] as [Frames, Frames])
}

/** What the host is asked to do to the composition's sequences for `op` on timeline `t` (read from them), in order;
 *  or why this operation isn't one the sequences can take yet. Each edit names sequences as they are before it. */
export function seqEdits(t: Timeline, op: Op): SeqEdit[] | { why: string } {
  const row = (id: string) => {
    const i = seqOf(id), at = find(t, id)
    return i !== undefined && at ? { i, clip: at.clip } : undefined
  }
  const each = (ids: string[], f: (r: { i: number; clip: Clip }) => SeqEdit): SeqEdit[] | { why: string } => {
    const rows = ids.map(row)
    return rows.every((r) => r) ? rows.map((r) => f(r!)) : { why: "that isn't one of the composition's sequences" }
  }
  switch (op.op) {
    case "move":
      if (op.track) return { why: "a sequence's lane is its place in the code: it moves in time only" }
      return each(op.ids, (r) => ({ op: "move", i: r.i, from: r.clip.start + Math.round(op.by), to: end(r.clip) + Math.round(op.by) }))
    case "trim":
      return each([op.id], (r) => (op.edge === "start" ? { op: "move", i: r.i, from: Math.min(end(r.clip) - 1, Math.max(0, Math.round(op.to))), to: end(r.clip) } : { op: "move", i: r.i, from: r.clip.start, to: Math.max(r.clip.start + 1, Math.round(op.to)) }))
    case "split": {
      const at = Math.round(op.at)
      const ids = op.ids ?? t.tracks.flatMap((k) => k.clips.filter((c) => c.start < at && at < end(c) && !c.locked).map((c) => c.id))
      // a split makes a sequence after the one it cuts, so later ones are named first
      const r = each(ids, (x) => ({ op: "split", i: x.i, at }))
      return Array.isArray(r) ? r.sort((a, b) => b.i - a.i) : r
    }
    case "remove": {
      const r = each(op.ids, (x) => ({ op: "delete", i: x.i }))
      return Array.isArray(r) ? r.sort((a, b) => b.i - a.i) : r
    }
    default:
      return { why: `the composition's sequences don't take "${op.op}" yet` }
  }
}
