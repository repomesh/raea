import { describe, expect, test } from "bun:test"
import { apply, applyAll, type Clip, empty, find, length, type Op, type Timeline, valueAt } from "../src"

const clip = (id: string, start: number, len: number, more: Partial<Clip> = {}): Clip => ({ id, kind: "video", start, length: len, ...more })
/** a main track of three clips (a 0-30, b 30-90, c 90-120), a title over b, music under all of it */
const film = (): Timeline => ({
  ...empty(30),
  tracks: [
    { id: "text-1", kind: "text", clips: [clip("title", 40, 30, { kind: "text" })] },
    { id: "main", kind: "main", clips: [clip("a", 0, 30, { in: 0, source: 300 }), clip("b", 30, 60, { in: 10, source: 300 }), clip("c", 90, 30, { in: 0, source: 30 })] },
    { id: "sound-1", kind: "sound", clips: [clip("music", 0, 120, { kind: "audio", in: 0, source: 900 })] },
  ],
})
const done = (t: Timeline, op: Op) => {
  const r = apply(t, op)
  if (!r.ok) throw new Error(r.why)
  return r.timeline
}
const at = (t: Timeline, id: string) => find(t, id)!.clip
const spans = (t: Timeline, track: string) => t.tracks.find((k) => k.id === track)!.clips.map((c) => `${c.id} ${c.start}-${c.start + c.length}`)

describe("TL0b: an operation is a pure function with an inverse", () => {
  const ops: Op[] = [
    { op: "move", ids: ["b"], by: 70 },
    { op: "trim", id: "b", edge: "start", to: 40 },
    { op: "trim", id: "a", edge: "end", to: 20 },
    { op: "split", at: 60 },
    { op: "remove", ids: ["a"] },
    { op: "cut", id: "b", side: "left", at: 50 },
    { op: "duplicate", ids: ["c"] },
    { op: "set", id: "b", set: { speed: 2 } },
    { op: "key", id: "b", prop: "scale", at: 10, value: 1.2 },
    { op: "mark", marker: { id: "m1", at: 45 } },
    { op: "track", id: "sound-1", set: { muted: true } },
    { op: "transition", transition: { id: "x1", kind: "dissolve", after: "a", length: 12 } },
    { op: "option", set: { magnet: false } },
  ]
  for (const op of ops)
    test(`${op.op} and its inverse give the timeline back`, () => {
      const t = film()
      const frozen = JSON.stringify(t)
      const r = apply(t, op)
      if (!r.ok) throw new Error(r.why)
      expect(JSON.stringify(t)).toBe(frozen)
      const back = apply(r.timeline, r.inverse)
      expect(back.ok && JSON.stringify(back.timeline)).toBe(frozen)
    })

  test("an operation that can't apply is refused with its reason", () => {
    const locked = done(film(), { op: "track", id: "main", set: { locked: true } })
    expect(apply(locked, { op: "move", ids: ["a"], by: 10 })).toEqual({ ok: false, why: "that track is locked" })
    expect(apply(film(), { op: "split", at: 500 })).toEqual({ ok: false, why: "no clip is under the playhead" })
    const coded = { ...film(), tracks: film().tracks.map((k) => ({ ...k, clips: k.clips.map((c) => (c.id === "a" ? { ...c, name: "Hook", locked: "set in code" } : c)) })) }
    expect(apply(coded, { op: "trim", id: "a", edge: "end", to: 10 })).toEqual({ ok: false, why: "Hook is set in code" })
  })

  test("several operations stop at the first refused, with the inverses of those made", () => {
    const r = applyAll(film(), [{ op: "split", at: 60 }, { op: "remove", ids: ["nope"] }, { op: "remove", ids: ["a"] }])
    expect(r.refused?.why).toBe("there is no clip nope")
    expect(r.inverse.length).toBe(1)
    expect(spans(r.timeline, "main")).toEqual(["a 0-30", "b 30-60", "b+ 60-90", "c 90-120"])
  })
})

describe("TL3: clips", () => {
  test("a trimmed edge moves the clip's place in its source, never past the source's ends, and comes back out", () => {
    const t = done(film(), { op: "option", set: { magnet: false } })
    const inward = done(t, { op: "trim", id: "b", edge: "start", to: 45 })
    expect(at(inward, "b")).toMatchObject({ start: 45, length: 45, in: 25 })
    // b's source starts 10 frames before it: it backs out to frame 30 - 10 = 20 at most (a ends at 30 on its track)
    expect(at(done(inward, { op: "trim", id: "b", edge: "start", to: 0 }), "b")).toMatchObject({ start: 30, in: 10 })
    // c has 30 frames of source in all: its end can't go past 120
    expect(at(done(t, { op: "trim", id: "c", edge: "end", to: 500 }), "c").length).toBe(30)
    expect(at(done(t, { op: "trim", id: "a", edge: "end", to: 0 }), "a").length).toBe(1)
  })

  test("a split writes the clip twice, meeting at the cut, the right half on in its source", () => {
    const t = done(film(), { op: "split", at: 60, ids: ["b"] })
    expect(spans(t, "main")).toEqual(["a 0-30", "b 30-60", "b+ 60-90", "c 90-120"])
    expect(at(t, "b+").in).toBe(40)
    // with none named, every clip under the playhead: the title and the music too
    const all = done(film(), { op: "split", at: 60 })
    expect(spans(all, "text-1")).toEqual(["title 40-60", "title+ 60-70"])
    expect(spans(all, "sound-1")).toEqual(["music 0-60", "music+ 60-120"])
  })

  test("a split clip's keys stay at their frames, with the value at the cut on both halves", () => {
    let t = done(film(), { op: "key", id: "b", prop: "scale", at: 0, value: 1 })
    t = done(t, { op: "key", id: "b", prop: "scale", at: 40, value: 2 })
    t = done(t, { op: "split", at: 50, ids: ["b"] })
    expect(at(t, "b").keys!.scale).toEqual([{ at: 0, value: 1 }, { at: 20, value: 1.5 }])
    expect(at(t, "b+").keys!.scale).toEqual([{ at: 0, value: 1.5 }, { at: 20, value: 2 }])
    expect(valueAt(at(t, "b+").keys!.scale, 10)).toBe(1.75)
  })

  test("Q removes what is left of the playhead on a clip, W what is right, the gap closed", () => {
    const q = done(film(), { op: "cut", id: "b", side: "left", at: 50 })
    expect(spans(q, "main")).toEqual(["a 0-30", "b 30-70", "c 70-100"])
    expect(at(q, "b").in).toBe(30)
    const w = done(film(), { op: "cut", id: "b", side: "right", at: 50 })
    expect(spans(w, "main")).toEqual(["a 0-30", "b 30-50", "c 50-80"])
    // on a track with no magnet the later clips still close up
    const two = { ...film(), tracks: [{ id: "sound-1", kind: "sound" as const, clips: [clip("x", 0, 60), clip("y", 60, 30)] }] }
    expect(spans(done(two, { op: "cut", id: "x", side: "right", at: 20 }), "sound-1")).toEqual(["x 0-20", "y 20-50"])
  })

  test("duplicate puts a copy after the clip", () => {
    expect(spans(done(film(), { op: "duplicate", ids: ["a"] }), "main")).toEqual(["a 0-30", "a+ 30-60", "b 60-120", "c 120-150"])
  })
})

describe("TL4: the magnet and linkage", () => {
  test("with the magnet on the main track has no gap: a removed clip's gap closes", () => {
    const t = done(film(), { op: "remove", ids: ["a"] })
    expect(spans(t, "main")).toEqual(["b 0-60", "c 60-90"])
    expect(length(t)).toBe(120) // the music is still 120 long
  })

  test("a clip dragged past its neighbour's middle swaps places with it", () => {
    // a (0-30) dragged 40 later: its middle (55) is short of b's (60), so nothing swaps; 50 later it is past
    expect(spans(done(film(), { op: "move", ids: ["a"], by: 40 }), "main")).toEqual(["a 0-30", "b 30-90", "c 90-120"])
    expect(spans(done(film(), { op: "move", ids: ["a"], by: 50 }), "main")).toEqual(["b 0-60", "a 60-90", "c 90-120"])
  })

  test("with the magnet off a gap is allowed, and a clip dropped over another goes to a track above", () => {
    const off = done(film(), { op: "option", set: { magnet: false } })
    expect(spans(done(off, { op: "remove", ids: ["a"] }), "main")).toEqual(["b 30-90", "c 90-120"])
    const over = done(off, { op: "move", ids: ["c"], by: -50 })
    expect(over.tracks.map((k) => k.id)).toEqual(["text-1", "overlay-1", "main", "sound-1"])
    expect(spans(over, "overlay-1")).toEqual(["c 40-70"])
  })

  test("what sits over a main clip moves and goes with it; with linkage off it stays", () => {
    // the title starts at 40, inside b (30-90): removing a moves b 30 earlier, and the title with it
    expect(spans(done(film(), { op: "remove", ids: ["a"] }), "text-1")).toEqual(["title 10-40"])
    expect(done(film(), { op: "remove", ids: ["b"] }).tracks.find((k) => k.id === "text-1")!.clips).toEqual([])
    const unlinked = done(film(), { op: "option", set: { linkage: false } })
    expect(spans(done(unlinked, { op: "remove", ids: ["a"] }), "text-1")).toEqual(["title 40-70"])
    // sound is never carried
    expect(spans(done(film(), { op: "remove", ids: ["a"] }), "sound-1")).toEqual(["music 0-120"])
  })

  test("a transition stays on its cut as the cut moves, and goes when the cut does", () => {
    const t = done(film(), { op: "transition", transition: { id: "x", kind: "dissolve", after: "b", length: 500 } })
    expect(t.transitions).toEqual([{ id: "x", kind: "dissolve", after: "b", length: 30 }])
    expect(done(t, { op: "remove", ids: ["a"] }).transitions.length).toBe(1)
    expect(done(t, { op: "remove", ids: ["c"] }).transitions).toEqual([])
  })
})

describe("TL6: speed", () => {
  test("a clip's length follows its speed, and the magnet closes the gap", () => {
    const t = done(film(), { op: "set", id: "b", set: { speed: 2 } })
    expect(spans(t, "main")).toEqual(["a 0-30", "b 30-60", "c 60-90"])
    expect(apply(film(), { op: "set", id: "b", set: { speed: 0 } })).toEqual({ ok: false, why: "a speed is more than 0" })
  })

  test("a curve's length is the time its source takes, and taking it off gives the length back", () => {
    const t = done(film(), { op: "set", id: "b", set: { curve: [{ at: 0, speed: 2 }, { at: 1, speed: 2 }] } })
    expect(at(t, "b").length).toBe(30)
    expect(at(done(t, { op: "set", id: "b", set: { curve: null } }), "b").length).toBe(60)
  })
})
