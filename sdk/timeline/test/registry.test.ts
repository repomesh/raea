import { describe, expect, test } from "bun:test"
import { CURVES, EASES, palette, readAdds, TRANSITIONS } from "../src"

describe("TL11a: a plugin adds easings, speed curves and transitions", () => {
  const raw = {
    eases: { snap: [0.9, 0, 0.1, 1], back: [0.3, 1.6, 0.6, 1], linear: "hold", bad: [2, 0, 0, 1] },
    curves: { pulse: [{ at: 0, speed: 1 }, { at: 0.5, speed: 4 }, { at: 1, speed: 1 }], hero: [{ at: 0, speed: 1 }, { at: 1, speed: 1 }], wild: [{ at: 0, speed: 50 }, { at: 1, speed: 1 }] },
    transitions: [{ kind: "Glitch", title: "Glitch" }, { kind: "fade", title: "Mine" }, { kind: "", title: "x" }],
  }

  test("what is well formed is offered after raea's own; the rest is left out with why", () => {
    const { adds, errors } = readAdds(raw)
    expect(adds).toEqual({ eases: { snap: [0.9, 0, 0.1, 1], back: [0.3, 1.6, 0.6, 1] }, curves: { pulse: raw.curves.pulse }, transitions: [{ kind: "Glitch", title: "Glitch" }] })
    expect(errors).toEqual([
      "timeline.eases.linear: raea has an easing of that name",
      'timeline.eases.bad is "linear", "hold" or a bezier\'s handles [x1, y1, x2, y2] with x1 and x2 from 0 to 1',
      "timeline.curves.hero: raea has a speed curve of that name",
      "timeline.curves.wild is two or more points { at, speed }, at from 0 to 1 and speed from 0.1 to 10",
      'timeline.transitions[1]: raea has a transition "fade"',
      "timeline.transitions[2] is { kind, title }: kind a name, title what the person sees",
    ])
    const all = palette([adds, { eases: { snap: "hold" } }])
    expect(Object.keys(all.eases)).toEqual([...Object.keys(EASES), "snap", "back"])
    expect(all.eases.snap).toEqual([0.9, 0, 0.1, 1])
    expect(Object.keys(all.curves)).toEqual([...Object.keys(CURVES), "pulse"])
    expect(all.transitions.map((t) => t.kind)).toEqual([...TRANSITIONS.map((t) => t.kind), "Glitch"])
  })

  test("with no plugin it is raea's own, and a manifest with no timeline adds nothing", () => {
    expect(palette().transitions).toEqual(TRANSITIONS)
    expect(readAdds(undefined)).toEqual({ adds: {}, errors: [] })
    expect(readAdds([1]).errors).toEqual(["timeline is an object: { eases, curves, transitions }"])
  })
})
