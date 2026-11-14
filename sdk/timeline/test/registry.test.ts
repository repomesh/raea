import { describe, expect, test } from "bun:test"
import { CURVES, EASES, palette, readAdds, TRANSITIONS } from "../src"

describe("TL11a: a plugin adds easings, speed curves and transitions", () => {
  const raw = {
    eases: { snap: [0.9, 0, 0.1, 1], back: [0.3, 1.6, 0.6, 1], linear: "hold", bad: [2, 0, 0, 1] },
    curves: { pulse: [{ at: 0, speed: 1 }, { at: 0.5, speed: 4 }, { at: 1, speed: 1 }], hero: [{ at: 0, speed: 1 }, { at: 1, speed: 1 }], wild: [{ at: 0, speed: 50 }, { at: 1, speed: 1 }] },
    transitions: [{ kind: "Glitch", title: "Glitch" }, { kind: "fade", title: "Mine" }, { kind: "", title: "x" }],
    tracks: [{ kind: "lighting", title: "Lighting cues" }, { kind: "sound", title: "Mine" }, { kind: "Bad Kind", title: "x" }, { kind: "cues", title: "Cues", under: true }],
  }

  test("what is well formed is offered after raea's own; the rest is left out with why", () => {
    const { adds, errors } = readAdds(raw)
    expect(adds).toEqual({ eases: { snap: [0.9, 0, 0.1, 1], back: [0.3, 1.6, 0.6, 1] }, curves: { pulse: raw.curves.pulse }, transitions: [{ kind: "Glitch", title: "Glitch" }], tracks: [{ kind: "lighting", title: "Lighting cues" }, { kind: "cues", title: "Cues", under: true }] })
    expect(errors).toEqual([
      "timeline.eases.linear: raea has an easing of that name",
      'timeline.eases.bad is "linear", "hold" or a bezier\'s handles [x1, y1, x2, y2] with x1 and x2 from 0 to 1',
      "timeline.curves.hero: raea has a speed curve of that name",
      "timeline.curves.wild is two or more points { at, speed }, at from 0 to 1 and speed from 0.1 to 10",
      'timeline.transitions[1]: raea has a transition "fade"',
      "timeline.transitions[2] is { kind, title }: kind a name, title what the person sees",
      'timeline.tracks[1]: raea has a track of kind "sound"',
      "timeline.tracks[2] is { kind, title }: kind in lowercase letters, digits and dashes, title what the person sees",
    ])
    expect(palette([adds]).tracks.map((t) => t.kind)).toEqual(["effect", "text", "overlay", "main", "sound", "lighting", "cues"])
    const all = palette([adds, { eases: { snap: "hold" } }])
    expect(Object.keys(all.eases)).toEqual([...Object.keys(EASES), "snap", "back"])
    expect(all.eases.snap).toEqual([0.9, 0, 0.1, 1])
    expect(Object.keys(all.curves)).toEqual([...Object.keys(CURVES), "pulse"])
    expect(all.transitions.map((t) => t.kind)).toEqual([...TRANSITIONS.map((t) => t.kind), "Glitch"])
  })

  test("with no plugin it is raea's own, and a manifest with no timeline adds nothing", () => {
    expect(palette().transitions).toEqual(TRANSITIONS)
    expect(readAdds(undefined)).toEqual({ adds: {}, errors: [] })
    expect(readAdds([1]).errors).toEqual(["timeline is an object: { eases, curves, transitions, tracks, effects }"])
  })
})

describe("TL11a: a plugin's effects", () => {
  test("are data: CSS filter functions from amount 0 to amount 1, checked, and offered after raea's own", () => {
    const { adds, errors } = readAdds({
      effects: [
        { kind: "dream", title: "Dream", parts: [["blur", 0, 6, "px"], ["saturate", 1, 1.6]] },
        { kind: "blur", title: "Mine", parts: [["blur", 0, 2, "px"]] },
        { kind: "shadow", title: "Shadow", parts: [["drop-shadow", 0, 1]] },
        { kind: "Bad Name", title: "x", parts: [["blur", 0, 2, "px"]] },
      ],
    })
    expect(adds.effects).toEqual([{ kind: "dream", title: "Dream", parts: [["blur", 0, 6, "px"], ["saturate", 1, 1.6]] }])
    expect(errors).toEqual([
      'timeline.effects[1]: raea has an effect "blur"',
      expect.stringContaining("timeline.effects[2] (shadow): a part's function is one of"),
      "timeline.effects[3] is { kind, title, parts }: kind in lowercase letters, digits and dashes, title what the person sees",
    ])
    const all = palette([adds]).effects
    expect(all[all.length - 1]).toEqual(adds.effects![0])
    expect(all.length).toBe(11)
  })
})
