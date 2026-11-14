// A timeline read from what is there (docs/timeline.feature TL0c, TL14a): a composition's sequences as the host
// lists them (raea-feed host/sequences.ts), or a film with no composition as its scenes and its sound. And an
// operation on a sequences' timeline as the host's own edits to those elements (docs/editing.feature E3b), until
// every operation is a code edit of its own (edits.ts).
import { type Clip, type Ease, empty, end, find, type Frames, type Key, type Timeline, type Track } from "./model"
import { apply, type Op } from "./ops"

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
  /** the keys its <Nudge> holds, each [frame of the sequence, value, ease?] (TL5d) */
  keys?: Record<string, [number, number, Ease?][]>
  /** how fast the footage it holds plays (its media's playbackRate), when it holds footage at one rate (TL6a) */
  speed?: number
  /** how it comes in and goes out: its <Transition>'s in and out (TL7a) */
  in?: { kind: string; frames: number }
  out?: { kind: string; frames: number }
  /** a <Video> or an <Audio> of its own (TL0c): it plays where the sequence it is in does, from `startFrom` of its
   *  file, at its own level */
  media?: "video" | "audio"
  startFrom?: number
  volume?: number
}
/** The host's edit to a sequence: its new span, a split, a delete. */
export type SeqEdit =
  | { op: "move"; i: number; from: number; to: number }
  | { op: "split"; i: number; at: number }
  | { op: "delete"; i: number }
  /** the sequence's keyed properties as they now stand: written as its <Nudge keys>, one a property (TL5d) */
  | { op: "keys"; i: number; keys: Record<string, [number, number, Ease?][]> }
  /** the footage it holds played at `speed`, its length following (TL6a) */
  | { op: "speed"; i: number; speed: number }
  /** how it comes in ("in") or goes out ("out"): its <Transition>'s edge set, or taken off with 0 frames (TL7a) */
  | { op: "edge"; i: number; side: "in" | "out"; kind: string; frames: number }
  /** a <Video>'s or an <Audio>'s own level (TL8a) */
  | { op: "level"; i: number; volume: number }

/** The transitions a composition's <Transition> draws (sdk/video transition.tsx). */
export const CODE_KINDS = ["fade", "slide", "wipe", "zoom"]
/** The properties a sequence's <Nudge> can key (sdk/video nudge.tsx). */
export const KEYED = ["x", "y", "scale", "rotate", "opacity"]

const seqId = (i: number) => `seq-${i}`
const seqOf = (id: string): number | undefined => (/^seq-\d+$/.test(id) ? Number(id.slice(4)) : undefined)

/** The composition's sequences as a timeline: a track a lane, the first lane on top as the strip draws it. The first
 *  lane is the main track, its magnet on, only when its clips already run from frame 0 with no gap: a composition's
 *  sequences are where its code puts them, and nothing here moves one that wasn't dragged. */
export function fromSequences(rows: SeqRow[], fps: number): Timeline {
  const media = rows.filter((r) => r.media)
  rows = rows.filter((r) => !r.media)
  const lanes = [...new Set(rows.map((r) => r.lane))].sort((a, b) => a - b)
  const clipsOf = (lane: number): Clip[] => rows.filter((r) => r.lane === lane).sort((a, b) => a.from - b.from).map((r) => ({ id: seqId(r.i), kind: "sequence", name: r.label ?? r.name, start: r.from, length: Math.max(1, r.to - r.from), ...(r.locked && { locked: r.locked }), ...(r.speed && r.speed !== 1 && { speed: r.speed }), ...(r.keys && Object.keys(r.keys).length && { keys: Object.fromEntries(Object.entries(r.keys).map(([p, ks]) => [p, ks.map(([at, value, ease]): Key => ({ at, value, ...(ease !== undefined && { ease }) }))])) }) }))
  const first = lanes.length ? clipsOf(lanes[0]) : []
  const gapless = first.length > 0 && first.every((c, n) => c.start === (n ? end(first[n - 1]) : 0))
  const tracks: Track[] = lanes.map((lane, n) => ({ id: n === 0 && gapless ? "main" : `overlay-${lane}`, kind: n === 0 && gapless ? "main" : "overlay", clips: clipsOf(lane) }))
  // a transition is on a cut: the part before it goes out and the part after it comes in, the same way
  const by = new Map(rows.map((r) => [seqId(r.i), r]))
  const transitions = tracks.flatMap((k) =>
    k.clips.flatMap((c) => {
      const out = by.get(c.id)?.out
      const next = k.clips.find((o) => o.start === end(c))
      const into = next && by.get(next.id)?.in
      return out && into && out.kind === into.kind ? [{ id: `x-${c.id}`, kind: out.kind, after: c.id, length: out.frames + into.frames }] : []
    }),
  )
  // footage and sound of their own: a track each kind, more where they play at once; a sound's below the picture
  const mediaTracks = (kind: "video" | "audio"): Track[] => {
    const out: Track[] = []
    for (const r of media.filter((m) => m.media === kind).sort((a, b) => a.from - b.from)) {
      const c: Clip = { id: seqId(r.i), kind, name: r.label ?? r.name, start: r.from, length: Math.max(1, r.to - r.from), in: r.startFrom ?? 0, ...(r.speed && r.speed !== 1 && { speed: r.speed }), ...(r.volume !== undefined && { volume: r.volume }), ...(r.locked && { locked: r.locked }) }
      const home = out.find((k) => k.clips.every((o) => end(o) <= c.start || o.start >= end(c)))
      if (home) home.clips.push(c)
      else out.push({ id: `${kind === "audio" ? "sound" : "footage"}-${out.length + 1}`, kind: kind === "audio" ? "sound" : "overlay", name: kind === "audio" ? "Sound" : "Footage", clips: [c] })
    }
    return out
  }
  // lanes below the first are nested deeper: drawn under it, as the strip has them
  return { ...empty(fps), tracks: [...tracks, ...mediaTracks("video"), ...mediaTracks("audio")], transitions, magnet: gapless }
}

/** A film with no composition behind it: its scenes as clips of one main track (cut where the picture cuts). Each
 *  clip is the film's picture and its sound together, as footage is until its sound is extracted (TL4c), so a cut,
 *  a move or a speed takes both. Its magnet is on: a scene removed closes up, as a cut of footage does. */
export function fromRender(o: { frames: Frames; fps: number; cuts?: Frames[] }): Timeline {
  const edges = [0, ...[...new Set(o.cuts ?? [])].filter((c) => c > 0 && c < o.frames).sort((a, b) => a - b), o.frames]
  const scenes: Clip[] = edges.slice(0, -1).map((from, n) => ({ id: `scene-${n + 1}`, kind: "video", name: `Scene ${n + 1}`, start: from, length: edges[n + 1] - from, in: from, source: o.frames }))
  return { ...empty(o.fps), tracks: [{ id: "main", kind: "main", clips: scenes }] }
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
  // a <Video> or an <Audio> plays where its sequence does: its level is its own, everything else its sequence's
  const isMedia = (id: string) => ["video", "audio"].includes(find(t, id)?.clip.kind ?? "") && /^(footage|sound)-/.test(find(t, id)?.track.id ?? "")
  const ids = "ids" in op && op.ids ? op.ids : "id" in op && typeof op.id === "string" ? [op.id] : []
  if (ids.some(isMedia)) {
    if (op.op === "set" && Object.keys(op.set).filter((k) => op.set[k as keyof typeof op.set] !== undefined).join() === "volume") return ids.flatMap((id) => { const i = seqOf(id); return i === undefined ? [] : [{ op: "level", i, volume: Math.round(Math.max(0, op.set.volume!) * 1000) / 1000 } as SeqEdit] })
    return { why: "footage and sound play where their sequence does: move, trim or speed the sequence; here only the level is its own" }
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
    case "transition":
    case "untransition": {
      const x = op.op === "transition" ? op.transition : t.transitions.find((o) => o.id === op.id)
      if (!x) return { why: "there is no such transition" }
      if (op.op === "transition" && !CODE_KINDS.includes(x.kind)) return { why: `a composition draws ${CODE_KINDS.join(", ")}: "${x.kind}" isn't one its <Transition> has` }
      const a = row(x.after), at = find(t, x.after)
      const b = at ? at.track.clips.find((c) => c.start === end(at.clip)) : undefined
      const nb = b && row(b.id)
      if (!a || !nb) return { why: "a transition sits on a cut between two of the composition's sequences" }
      // half on each side of the cut, no longer than either part
      const len = op.op === "transition" ? Math.max(1, Math.min(Math.round(x.length), a.clip.length * 2, nb.clip.length * 2)) : 0
      return [
        { op: "edge", i: a.i, side: "out", kind: x.kind, frames: Math.ceil(len / 2) },
        { op: "edge", i: nb.i, side: "in", kind: x.kind, frames: Math.floor(len / 2) },
      ]
    }
    case "set": {
      // a speed alone is the footage's rate; anything else a sequence has is its own code's
      const only = Object.keys(op.set).filter((k) => op.set[k as keyof typeof op.set] !== undefined)
      if (only.length !== 1 || only[0] !== "speed" || !(op.set.speed! > 0)) return { why: `the composition's sequences take a speed, not ${only.join(", ") || "that"}, yet` }
      return each([op.id], (r) => ({ op: "speed", i: r.i, speed: Math.round(op.set.speed! * 1000) / 1000 }))
    }
    case "key":
    case "unkey":
    case "moveKey":
    case "ease": {
      if (!KEYED.includes(op.prop)) return { why: `a sequence keys its ${KEYED.join(", ")}: ${op.prop} is its own code's` }
      if (op.op === "key" && typeof op.value !== "number") return { why: `${op.prop} is a number` }
      const r = row(op.id)
      if (!r) return { why: "that isn't one of the composition's sequences" }
      // the keys as the operation leaves them, every property: the wrapper's one prop is written whole
      const after = apply(t, op)
      if (!after.ok) return { why: after.why }
      const keys = find(after.timeline, op.id)?.clip.keys ?? {}
      return [{ op: "keys", i: r.i, keys: Object.fromEntries(Object.entries(keys).filter(([p]) => KEYED.includes(p)).map(([p, ks]) => [p, ks.map((k): [number, number, Ease?] => (k.ease === undefined || k.ease === "linear" ? [k.at, k.value as number] : [k.at, k.value as number, k.ease]))])) }]
    }
    default:
      return { why: `the composition's sequences don't take "${op.op}" yet` }
  }
}

// ---------------------------------------------------------------- a sound's own tracks (TL14b)

/** A track of a sound in the feed as its host lists it (raea-feed host/sounds.ts), in seconds of the render. */
export interface SoundTrack {
  id: string
  name: string
  kind: "notes" | "clips" | "lines"
  bus: string
  clips: { id: string; from: number; to: number; label: string; src?: string; offset?: number; gainDb?: number }[]
}
/** A clip's span and level, in seconds and dB: what the host writes back for a clip that was moved, trimmed or
 *  turned up or down (raea-feed host/clips.ts). */
export interface ClipSpan {
  start: number
  end: number
  offset: number
  gainDb: number
}

const level = (db: number) => Math.round(10 ** (db / 20) * 1000) / 1000
const dB = (v: number) => Math.round(20 * Math.log10(Math.max(v, 0.001)) * 10) / 10

/** A sound's tracks as a timeline: a sound track each, by its bus; a clip of a file keeps its place in the file
 *  (its offset) and its level. Notes and lines are clips too, locked here: they are edited where they are written
 *  (the roll, the words). No magnet: a mix's clips are where they were put. */
export function fromTracks(tracks: SoundTrack[], fps: number): Timeline {
  const f = (s: number) => Math.round(s * fps)
  return {
    ...empty(fps),
    magnet: false,
    tracks: tracks.map((k) => ({
      id: k.id,
      kind: "sound" as const,
      name: k.name,
      clips: k.clips
        .map((c): Clip => ({ id: c.id, kind: k.kind === "clips" ? "audio" : k.kind, name: c.label, start: f(c.from), length: Math.max(1, f(c.to) - f(c.from)), ...(c.src ? { in: f(c.offset ?? 0), at: c.src, volume: level(c.gainDb ?? 0) } : { locked: k.kind === "notes" ? "edited on its roll" : "edited in its words" }) }))
        .sort((a, b) => a.start - b.start),
    })),
  }
}

/** A clip of a file as the host is told it: where it plays, how far into its file, how loud. */
const spanOf = (c: Clip, fps: number): ClipSpan => ({ start: c.start / fps, end: end(c) / fps, offset: (c.in ?? 0) / fps, gainDb: dB(c.volume ?? 1) })

/** The file clips that differ between the timeline as it was read and as it stands, each with its span before and
 *  after: what a sound's hand edit carries (its `clips`). A clip that was removed or made here isn't one of these. */
export function clipEdits(read: Timeline, now: Timeline): { id: string; src: string; from: ClipSpan; to: ClipSpan }[] {
  const out: { id: string; src: string; from: ClipSpan; to: ClipSpan }[] = []
  for (const k of read.tracks)
    for (const was of k.clips) {
      const is = find(now, was.id)?.clip
      if (!was.at || !is) continue
      const a = spanOf(was, read.fps), b = spanOf(is, now.fps)
      if (a.start !== b.start || a.end !== b.end || a.offset !== b.offset || a.gainDb !== b.gainDb) out.push({ id: was.id, src: was.at, from: a, to: b })
    }
  return out
}
