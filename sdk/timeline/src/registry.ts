// What the timeline offers by name, and what a plugin adds to it (docs/timeline.feature TL11a): easings, speed
// curves and transitions, as data. raea's own come first and can't be replaced; a plugin's are checked before they
// are offered, and one that isn't well formed is left out with why.
import { EASES } from "./keys"
import type { Ease, SpeedPoint } from "./model"
import { CURVES, FASTEST, SLOWEST } from "./speed"

export interface TransitionKind {
  /** the component's name in the composition's code */
  kind: string
  title: string
}

/** What one plugin adds. */
export interface Adds {
  eases?: Record<string, Ease>
  curves?: Record<string, SpeedPoint[]>
  transitions?: TransitionKind[]
}

/** raea's own transitions (TL7a). */
export const TRANSITIONS: TransitionKind[] = [
  { kind: "dissolve", title: "Dissolve" },
  { kind: "fade", title: "Fade through black" },
  { kind: "wipe", title: "Wipe" },
  { kind: "slide", title: "Slide" },
]

const isEase = (e: unknown): e is Ease => e === "linear" || e === "hold" || (Array.isArray(e) && e.length === 4 && e.every((n) => typeof n === "number" && Number.isFinite(n)) && e[0] >= 0 && e[0] <= 1 && e[2] >= 0 && e[2] <= 1)
const isCurve = (c: unknown): c is SpeedPoint[] =>
  Array.isArray(c) && c.length >= 2 && c.every((p) => p && typeof p.at === "number" && p.at >= 0 && p.at <= 1 && typeof p.speed === "number" && p.speed >= SLOWEST && p.speed <= FASTEST)

/** A plugin's additions as written in its manifest, checked: what is well formed, and why the rest isn't. */
export function readAdds(raw: unknown): { adds: Adds; errors: string[] } {
  const errors: string[] = []
  const adds: Adds = {}
  if (raw === undefined) return { adds, errors }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { adds, errors: ["timeline is an object: { eases, curves, transitions }"] }
  const r = raw as Record<string, unknown>
  const named = (v: unknown, what: string): [string, unknown][] => (v === undefined ? [] : v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v) : (errors.push(`timeline.${what} is an object of named ${what}`), []))
  for (const [name, e] of named(r.eases, "eases")) {
    if (name in EASES) errors.push(`timeline.eases.${name}: raea has an easing of that name`)
    else if (!isEase(e)) errors.push(`timeline.eases.${name} is "linear", "hold" or a bezier's handles [x1, y1, x2, y2] with x1 and x2 from 0 to 1`)
    else (adds.eases ??= {})[name] = e
  }
  for (const [name, c] of named(r.curves, "curves")) {
    if (name in CURVES) errors.push(`timeline.curves.${name}: raea has a speed curve of that name`)
    else if (!isCurve(c)) errors.push(`timeline.curves.${name} is two or more points { at, speed }, at from 0 to 1 and speed from ${SLOWEST} to ${FASTEST}`)
    else (adds.curves ??= {})[name] = c
  }
  if (r.transitions !== undefined) {
    if (!Array.isArray(r.transitions)) errors.push("timeline.transitions is a list of { kind, title }")
    else
      for (const [i, x] of r.transitions.entries()) {
        const t = x as Partial<TransitionKind> | null
        if (!t || typeof t.kind !== "string" || !/^[A-Za-z][\w-]*$/.test(t.kind) || typeof t.title !== "string" || !t.title.trim()) errors.push(`timeline.transitions[${i}] is { kind, title }: kind a name, title what the person sees`)
        else if (TRANSITIONS.some((o) => o.kind === t.kind)) errors.push(`timeline.transitions[${i}]: raea has a transition "${t.kind}"`)
        else (adds.transitions ??= []).push({ kind: t.kind, title: t.title })
      }
  }
  return { adds, errors }
}

/** Everything offered: raea's own, then each plugin's in order (a name a plugin before it took stays that one's). */
export function palette(plugins: Adds[] = []): { eases: Record<string, Ease>; curves: Record<string, SpeedPoint[]>; transitions: TransitionKind[] } {
  const eases = { ...EASES }, curves = { ...CURVES }, transitions = [...TRANSITIONS]
  for (const p of plugins) {
    for (const [n, e] of Object.entries(p.eases ?? {})) if (!(n in eases)) eases[n] = e
    for (const [n, c] of Object.entries(p.curves ?? {})) if (!(n in curves)) curves[n] = c
    for (const t of p.transitions ?? []) if (!transitions.some((o) => o.kind === t.kind)) transitions.push(t)
  }
  return { eases, curves, transitions }
}
