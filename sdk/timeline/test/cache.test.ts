import { describe, expect, test } from "bun:test"
import { ahead, apply, changed, type Clip, empty, evict, joined, keyOf, type Timeline, without } from "../src"

const clip = (id: string, start: number, len: number, more: Partial<Clip> = {}): Clip => ({ id, kind: "video", start, length: len, ...more })
const film = (): Timeline => ({
  ...empty(30),
  magnet: false,
  tracks: [
    { id: "overlay-1", kind: "overlay", clips: [clip("logo", 3600, 150)] },
    { id: "main", kind: "main", clips: [clip("a", 0, 3000), clip("b", 3000, 3000)] },
    { id: "sound-1", kind: "sound", clips: [clip("music", 0, 6000, { kind: "audio" })] },
  ],
})
const done = (t: Timeline, op: Parameters<typeof apply>[1]) => {
  const r = apply(t, op)
  if (!r.ok) throw new Error(r.why)
  return r.timeline
}

describe("TL10c: an edit drops only what it changed", () => {
  test("a clip moved from 2:00-2:05 to 2:10-2:15 changes those two ranges and nothing else", () => {
    const t = film()
    expect(changed(t, done(t, { op: "move", ids: ["logo"], by: 300 }))).toEqual([[3600, 3750], [3900, 4050]])
  })

  test("a key, a hidden track and a transition change the spans they draw; a name, a lock and a marker change nothing", () => {
    const t = film()
    expect(changed(t, done(t, { op: "key", id: "logo", prop: "scale", at: 10, value: 2 }))).toEqual([[3600, 3750]])
    expect(changed(t, done(t, { op: "track", id: "overlay-1", set: { hidden: true } }))).toEqual([[3600, 3750]])
    expect(changed(t, done(t, { op: "track", id: "sound-1", set: { muted: true } }))).toEqual([[0, 6000]])
    expect(changed(t, done(t, { op: "transition", transition: { id: "x", kind: "dissolve", after: "a", length: 30 } }))).toEqual([[2985, 3015]])
    expect(changed(t, done(t, { op: "set", id: "a", set: { name: "Opening" } }))).toEqual([])
    expect(changed(t, done(t, { op: "track", id: "main", set: { locked: true, height: 80 } }))).toEqual([])
    expect(changed(t, done(t, { op: "mark", marker: { id: "m", at: 100 } }))).toEqual([])
  })

  test("a split of footage draws the same frames: nothing is drawn again; a split of anything else restarts its right half", () => {
    const footage: Timeline = { ...film(), tracks: [{ id: "main", kind: "main", clips: [clip("a", 0, 3000, { in: 0, source: 9000 })] }] }
    expect(changed(footage, done(footage, { op: "split", at: 1000, ids: ["a"] }))).toEqual([])
    // and one half deleted changes only that half (the magnet off: the other stays put)
    const cut = done(done(footage, { op: "split", at: 1000, ids: ["a"] }), { op: "remove", ids: ["a"] })
    expect(changed(footage, cut)).toEqual([[0, 1000]])
    const t = film()
    expect(changed(t, done(t, { op: "split", at: 1000, ids: ["a"] }))).toEqual([[0, 3000]])
  })

  test("a range's key is the same for two states that draw it the same, and differs when they don't", () => {
    const t = film()
    const moved = done(t, { op: "move", ids: ["logo"], by: 300 })
    expect(keyOf(moved, [0, 3000])).toBe(keyOf(t, [0, 3000]))
    expect(keyOf(moved, [3600, 3750])).not.toBe(keyOf(t, [3600, 3750]))
    // undone: the frames kept before the edit are found again
    expect(keyOf(done(moved, { op: "move", ids: ["logo"], by: -300 }), [3600, 3750])).toBe(keyOf(t, [3600, 3750]))
    // the same clip over other media is another picture
    expect(keyOf(t, [0, 3000], () => "v2")).not.toBe(keyOf(t, [0, 3000], () => "v1"))
  })
})

describe("TL10d, TL10e: what is drawn next, and what goes first", () => {
  test("ranges join, and one taken out of another leaves the rest", () => {
    expect(joined([[10, 20], [0, 5], [5, 10], [30, 30], [18, 25]])).toEqual([[0, 25]])
    expect(without([[0, 100]], [[20, 30], [90, 120]])).toEqual([[0, 20], [30, 90]])
  })

  test("from the playhead on first, nearest first, then what is behind it", () => {
    expect(ahead(300, [[100, 160]], 120, 60)).toEqual([[160, 220], [220, 280], [280, 300], [60, 100], [0, 60]])
    expect(ahead(300, [[0, 300]], 0, 60)).toEqual([])
  })

  test("a closed version's frames go at once, then the least recently played, never what is under the playhead while anything else can go", () => {
    const kept = [
      { key: "old", bytes: 40, used: 1 },
      { key: "here", bytes: 40, used: 2 },
      { key: "recent", bytes: 40, used: 9 },
      { key: "closed", bytes: 10, used: 8, stale: true },
    ]
    expect(evict(kept, 1000)).toEqual(["closed"])
    expect(evict(kept, 90, new Set(["here"]))).toEqual(["closed", "old"])
    expect(evict(kept, 30, new Set(["here"]))).toEqual(["closed", "old", "recent", "here"])
  })
})
