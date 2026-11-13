// The timeline's model (docs/timeline.feature TL0). Time is whole frames (TL0a): a clip's start, length and trim, a
// key and a marker are integers; seconds and timecodes are drawn from them, never the other way.

export type Frames = number

/** A track's kind, in the order they stack from the top (TL1a): effect, text, overlay, main, sound. A plugin adds
 *  its own (TL11a); an unknown kind sorts with the overlays. */
export type TrackKind = "effect" | "text" | "overlay" | "main" | "sound" | (string & {})
export const ORDER: TrackKind[] = ["effect", "text", "overlay", "main", "sound"]

/** How a value travels from one key to the next: a straight line, no travel (it holds, then jumps), or a cubic
 *  bezier's two handles [x1, y1, x2, y2] as CSS writes them (TL5c). */
export type Ease = "linear" | "hold" | [number, number, number, number]

export type Value = number | number[] | string

/** A property's value at a frame of its clip (frames from the clip's start), and how it leaves for the next key. */
export interface Key {
  at: Frames
  value: Value
  ease?: Ease
}

/** A point of a speed curve (TL6b): how fast the source plays at a place in it (0 its first frame shown, 1 its last). */
export interface SpeedPoint {
  at: number
  speed: number
}

export interface Marker {
  id: string
  at: Frames
  name?: string
  color?: string
}

export interface Clip {
  id: string
  /** what it is: "video", "audio", "text", "sequence", "component", "effect", a plugin's own */
  kind: string
  name?: string
  /** where it starts on the timeline, and for how long */
  start: Frames
  length: Frames
  /** media: the first source frame it shows, and how many frames the source has (unset: no end to trim against) */
  in?: Frames
  source?: Frames
  /** a constant speed (1 when unset), or a curve, which wins (TL6) */
  speed?: number
  curve?: SpeedPoint[]
  /** turned off: drawn dimmed, left out of the picture and the sound (TL3g) */
  off?: boolean
  /** it can't be changed here, and why ("set in code", TL0c) */
  locked?: string
  /** clips with one group pick and move as one (TL3g) */
  group?: string
  /** still values, and keyed ones (TL5): a keyed property's still value is ignored */
  props?: Record<string, Value | boolean>
  keys?: Record<string, Key[]>
  /** sound: its level (1 as recorded) and its fades' lengths (TL8a) */
  volume?: number
  fadeIn?: Frames
  fadeOut?: Frames
  /** its element in the code (file:line:col, docs/editing.feature E2) */
  at?: string
  /** markers on the clip itself, in frames from its start (TL2e) */
  markers?: Marker[]
}

export interface Track {
  id: string
  kind: TrackKind
  name?: string
  locked?: boolean
  hidden?: boolean
  muted?: boolean
  /** drawn this tall, in px (TL1c) */
  height?: number
  clips: Clip[]
}

/** A transition on the cut between two clips that touch on one track (TL7a): the cut is the end of clip `after`,
 *  so it follows that cut wherever an edit moves it. */
export interface Transition {
  id: string
  kind: string
  after: string
  length: Frames
}

export interface Timeline {
  fps: number
  tracks: Track[]
  markers: Marker[]
  transitions: Transition[]
  /** the main track holds no gap (TL4a), edges snap (TL4b), what sits over a main clip follows it (TL4c) */
  magnet: boolean
  snapping: boolean
  linkage: boolean
}

export const empty = (fps = 30): Timeline => ({ fps, tracks: [], markers: [], transitions: [], magnet: true, snapping: true, linkage: true })

export const end = (c: Clip): Frames => c.start + c.length
/** The timeline's length: its last clip's end. */
export const length = (t: Timeline): Frames => Math.max(0, ...t.tracks.flatMap((k) => k.clips.map(end)))
export const clips = (t: Timeline): Clip[] => t.tracks.flatMap((k) => k.clips)
export const find = (t: Timeline, id: string): { track: Track; clip: Clip } | undefined => {
  for (const track of t.tracks) {
    const clip = track.clips.find((c) => c.id === id)
    if (clip) return { track, clip }
  }
}
/** A clip's speed where it is constant. */
export const speedOf = (c: Clip): number => (c.speed && c.speed > 0 ? c.speed : 1)

/** mm:ss:ff, drawn from frames (TL0a). */
export function timecode(frames: Frames, fps: number): string {
  const f = Math.max(0, Math.round(frames))
  const whole = Math.round(fps)
  const two = (n: number) => String(n).padStart(2, "0")
  return `${two(Math.floor(f / whole / 60))}:${two(Math.floor(f / whole) % 60)}:${two(f % whole)}`
}

/** Where a track of this kind goes among the others (TL1a): after the last of its own kind, else in ORDER's place. */
export function slot(tracks: Track[], kind: TrackKind): number {
  const rank = (k: TrackKind) => (ORDER.includes(k) ? ORDER.indexOf(k) : ORDER.indexOf("overlay"))
  // sound tracks grow downward (a new one goes under the others); every other kind grows upward
  if (kind === "sound") return tracks.length
  const first = tracks.findIndex((t) => rank(t.kind) >= rank(kind))
  return first < 0 ? tracks.length : first
}
