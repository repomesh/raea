// The frames kept while editing (docs/timeline.feature TL10): which ranges an edit changed (so only those are drawn
// again, TL10c), what a kept range is kept under (TL10b), and what goes first when the store is over its size
// (TL10e). Pure: the stage that draws frames and the store that holds them use these to decide.
import { type Clip, end, type Frames, type Timeline, type Track } from "./model"

export type Range = [from: Frames, to: Frames]

/** Ranges in order, touching and overlapping ones joined, empty ones dropped. */
export function joined(ranges: Range[]): Range[] {
  const out: Range[] = []
  for (const [a, b] of [...ranges].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/** `ranges` with `cut` taken out of them. */
export function without(ranges: Range[], cut: Range[]): Range[] {
  let out = joined(ranges)
  for (const [c0, c1] of joined(cut)) out = out.flatMap(([a, b]): Range[] => (c1 <= a || c0 >= b ? [[a, b]] : [[a, Math.min(b, c0)], [Math.max(a, c1), b]])).filter(([a, b]) => b > a)
  return out
}

const drawn = (k: Track, c: Clip) => !c.off && !(k.kind === "sound" ? k.muted : k.hidden)
/** What a clip draws, said so that the same pictures give the same words wherever the clip is cut: a media clip
 *  by where its source sits against the timeline (so the two halves of a split say what the whole did), anything
 *  else by where it starts (its content runs from its own first frame). Keys and fades are said at their timeline
 *  frames. Its name, its lock and its group aren't in it. */
function look(k: Track, n: number, c: Clip): string {
  const still = c.in !== undefined && !c.curve
  const phase = still ? `p${c.in! - c.start * (c.speed && c.speed > 0 ? c.speed : 1)}` : `s${c.start}+${c.length}`
  const keys = Object.entries(c.keys ?? {}).map(([p, ks]) => [p, ks.map((x) => [x.at + c.start, x.value, x.ease ?? "linear"])])
  const fades = [c.fadeIn ? [c.start, c.fadeIn] : 0, c.fadeOut ? [end(c), c.fadeOut] : 0]
  // footage whose sound was taken out says so only then, so what was kept before it was a field still matches
  return JSON.stringify([n, k.kind, c.kind, c.freeze ? `f${c.in}` : c.reverse ? `r${c.start}+${c.length}:${c.in}` : phase, c.speed ?? 1, c.curve ?? null, c.shows ?? null, c.props ?? null, keys, c.volume ?? 1, fades, c.at ?? null, ...(c.muted ? ["muted"] : [])])
}

/** Every drawn thing on the timeline as the span it covers and what it draws there. */
function spans(t: Timeline): { span: Range; look: string }[] {
  const out: { span: Range; look: string }[] = []
  t.tracks.forEach((k, n) => {
    for (const c of k.clips) if (drawn(k, c)) out.push({ span: [c.start, end(c)], look: look(k, n, c) })
  })
  for (const x of t.transitions) {
    const c = t.tracks.flatMap((k) => k.clips).find((o) => o.id === x.after)
    const half = Math.ceil(x.length / 2)
    if (c) out.push({ span: [end(c) - half, end(c) + half], look: `x:${x.kind}:${x.length}:${end(c)}` })
  }
  return out
}

/** The frames whose picture or sound differ between two states of a timeline: wherever what is drawn over a frame
 *  isn't what was. Moving a clip from 2:00-2:05 to 2:10-2:15 gives those two ranges and nothing else (TL10c); a
 *  split of footage gives none. */
export function changed(before: Timeline, after: Timeline): Range[] {
  const a = spans(before), b = spans(after)
  const edges = [...new Set([...a, ...b].flatMap((x) => x.span))].sort((x, y) => x - y)
  const over = (xs: { span: Range; look: string }[], from: Frames, to: Frames) => xs.filter((x) => x.span[0] < to && x.span[1] > from).map((x) => x.look).sort().join("\n")
  const out: Range[] = []
  for (let i = 0; i + 1 < edges.length; i++) if (over(a, edges[i], edges[i + 1]) !== over(b, edges[i], edges[i + 1])) out.push([edges[i], edges[i + 1]])
  return joined(out)
}

/** What a range of kept frames is kept under: everything that draws it. Two states of a timeline that draw the
 *  range the same give the same key, so frames drawn before an edit elsewhere (or before an undo) are found again. */
export function keyOf(t: Timeline, [from, to]: Range, media: (clip: Clip) => string = () => ""): string {
  const parts: string[] = [`${t.fps}`]
  t.tracks.forEach((k, n) => {
    for (const c of k.clips) if (drawn(k, c) && c.start < to && end(c) > from) parts.push(`${look(k, n, c)}:${media(c)}`)
  })
  for (const x of spans(t)) if (x.look.startsWith("x:") && x.span[0] < to && x.span[1] > from) parts.push(x.look)
  // FNV-1a over the parts: a short name for a file, not a secret
  let h = 0x811c9dc5
  for (const ch of parts.sort().join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  return `${from}-${to}-${h.toString(16).padStart(8, "0")}`
}

/** A drawn range in the store, as the clearing reads it (TL10e). */
export interface Kept {
  /** the range's key (rangeKey): what it is drawn from */
  key: string
  /** what it takes on disk */
  bytes: number
  /** when it was last played (ms) */
  used: number
  /** it belongs to a version that was closed or discarded: it goes at once */
  stale?: boolean
}

/** The keys to drop so the store is at most `limit` bytes: stale ones first, then the least recently played. What
 *  is under the playhead (`hold`) stays while anything else can go (TL10e). */
export function evict(kept: Kept[], limit: number, hold: Set<string> = new Set()): string[] {
  let total = kept.reduce((n, k) => n + k.bytes, 0)
  const out: string[] = []
  const order = [...kept].sort((a, b) => Number(!!b.stale) - Number(!!a.stale) || Number(hold.has(a.key)) - Number(hold.has(b.key)) || a.used - b.used)
  for (const k of order) {
    if (!k.stale && total <= limit) break
    out.push(k.key)
    total -= k.bytes
  }
  return out
}

/** The ranges to draw next while there is time (TL10d): what isn't kept from the playhead on, nearest first, each
 *  at most `chunk` frames, then what is before it. */
export function ahead(length: Frames, kept: Range[], playhead: Frames, chunk: Frames): Range[] {
  const missing = without([[0, length]], kept)
  const pieces = missing.flatMap(([a, b]): Range[] => Array.from({ length: Math.ceil((b - a) / chunk) }, (_, i) => [a + i * chunk, Math.min(b, a + (i + 1) * chunk)] as Range))
  const after = pieces.filter(([, b]) => b > playhead).sort((x, y) => x[0] - y[0])
  const before = pieces.filter(([, b]) => b <= playhead).sort((x, y) => y[0] - x[0])
  return [...after, ...before]
}
