// A clip's speed (docs/timeline.feature TL6): constant, or a curve of points over its source, each from 0.1x to 10x.
// Between two points the speed changes in a straight line over the source, so the time a span of source takes and
// the source frame at a time both have closed forms.
import type { SpeedPoint } from "./model"

export const SLOWEST = 0.1
export const FASTEST = 10
const clamp = (v: number) => Math.min(FASTEST, Math.max(SLOWEST, v))

/** CapCut's curve presets (TL6b), as points over the source; a plugin adds its own (TL11a). */
export const CURVES: Record<string, SpeedPoint[]> = {
  montage: [{ at: 0, speed: 1 }, { at: 0.25, speed: 3 }, { at: 0.5, speed: 0.5 }, { at: 0.75, speed: 3 }, { at: 1, speed: 1 }],
  hero: [{ at: 0, speed: 1 }, { at: 0.3, speed: 5 }, { at: 0.5, speed: 0.4 }, { at: 0.7, speed: 5 }, { at: 1, speed: 1 }],
  bullet: [{ at: 0, speed: 5 }, { at: 0.4, speed: 5 }, { at: 0.5, speed: 0.3 }, { at: 0.6, speed: 5 }, { at: 1, speed: 5 }],
  "jump cut": [{ at: 0, speed: 0.5 }, { at: 0.45, speed: 0.5 }, { at: 0.5, speed: 6 }, { at: 0.55, speed: 0.5 }, { at: 1, speed: 0.5 }],
  "flash in": [{ at: 0, speed: 5 }, { at: 0.4, speed: 2 }, { at: 1, speed: 1 }],
  "flash out": [{ at: 0, speed: 1 }, { at: 0.6, speed: 2 }, { at: 1, speed: 5 }],
}

/** The curve as points from 0 to 1 in order, each speed in range. */
export function points(curve: SpeedPoint[]): SpeedPoint[] {
  const ps = curve.map((p) => ({ at: Math.min(1, Math.max(0, p.at)), speed: clamp(p.speed) })).sort((a, b) => a.at - b.at)
  if (!ps.length) return [{ at: 0, speed: 1 }, { at: 1, speed: 1 }]
  if (ps[0].at > 0) ps.unshift({ at: 0, speed: ps[0].speed })
  if (ps[ps.length - 1].at < 1) ps.push({ at: 1, speed: ps[ps.length - 1].speed })
  return ps
}

// the time `span` of source takes while the speed goes from v0 to v1 across it
const took = (span: number, v0: number, v1: number) => (Math.abs(v1 - v0) < 1e-9 ? span / v0 : (span * Math.log(v1 / v0)) / (v1 - v0))

/** How many frames `source` frames of source take to play under the curve. */
export function played(curve: SpeedPoint[], source: number): number {
  const ps = points(curve)
  let t = 0
  for (let i = 0; i + 1 < ps.length; i++) t += took((ps[i + 1].at - ps[i].at) * source, ps[i].speed, ps[i + 1].speed)
  return t
}

/** The source frame showing `time` frames into the clip, under the curve over `source` frames of source. */
export function sourceAt(curve: SpeedPoint[], source: number, time: number): number {
  const ps = points(curve)
  let t = Math.max(0, time)
  for (let i = 0; i + 1 < ps.length; i++) {
    const span = (ps[i + 1].at - ps[i].at) * source, v0 = ps[i].speed, v1 = ps[i + 1].speed
    const whole = took(span, v0, v1)
    if (t > whole) {
      t -= whole
      continue
    }
    // within this span: v(s) = v0 + k s, and t = ln(v(s) / v0) / k
    const k = span > 0 ? (v1 - v0) / span : 0
    const s = Math.abs(k) < 1e-9 ? t * v0 : (v0 * (Math.exp(k * t) - 1)) / k
    return ps[i].at * source + Math.min(span, s)
  }
  return source
}

/** The speed at each of `n` places along the clip's own time (the line drawn over the clip, TL6b). */
export function profile(curve: SpeedPoint[], source: number, n: number): number[] {
  const ps = points(curve), total = played(curve, source)
  return Array.from({ length: n }, (_, i) => {
    const at = source > 0 ? sourceAt(curve, source, (total * i) / Math.max(1, n - 1)) / source : 0
    const j = Math.max(0, ps.findIndex((p) => p.at > at) - 1)
    const a = ps[j], b = ps[Math.min(ps.length - 1, j + 1)]
    return b.at > a.at ? a.speed + ((b.speed - a.speed) * (at - a.at)) / (b.at - a.at) : a.speed
  })
}
