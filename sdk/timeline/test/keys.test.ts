import { describe, expect, test } from "bun:test"
import { bezier, CURVES, eased, EASES, played, profile, snap, snapMove, sourceAt, targets, timecode, valueAt, empty } from "../src"

describe("TL5: keys and easing", () => {
  test("between two keys the value follows the first key's ease; outside them it holds", () => {
    const keys = [{ at: 10, value: 0 }, { at: 30, value: 100 }]
    expect([0, 10, 20, 30, 99].map((f) => valueAt(keys, f))).toEqual([0, 0, 50, 100, 100])
    expect(valueAt([{ at: 10, value: 0, ease: "hold" }, { at: 30, value: 100 }], 29)).toBe(0)
    expect(valueAt([{ at: 0, value: [0, 0] }, { at: 10, value: [100, 50] }], 5)).toEqual([50, 25])
    expect(valueAt([{ at: 0, value: "red" }, { at: 10, value: "blue" }], 5)).toBe("red")
    expect(valueAt(undefined, 5)).toBeUndefined()
  })

  test("a cubic bezier is CSS's: its ends fixed, ease in-out through the middle, ease out ahead of linear", () => {
    const io = bezier(0.42, 0, 0.58, 1)
    expect(io(0)).toBe(0)
    expect(io(1)).toBe(1)
    expect(io(0.5)).toBeCloseTo(0.5, 4)
    expect(io(0.25)).toBeCloseTo(0.1292, 3)
    expect(eased(EASES["ease out"], 0.5)).toBeGreaterThan(0.5)
    expect(eased(EASES["ease in"], 0.5)).toBeLessThan(0.5)
    // a handle above 1 overshoots, as a curve dragged by hand can
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => bezier(0.3, 1.6, 0.6, 1)(i / 49)))).toBeGreaterThan(1)
    // every x has one y, even where the curve is steep
    const steep = bezier(0, 1, 1, 0)
    for (let i = 1; i < 20; i++) expect(Number.isFinite(steep(i / 20))).toBe(true)
  })
})

describe("TL6b: a speed curve", () => {
  test("a flat curve is a constant speed", () => {
    const twice = [{ at: 0, speed: 2 }, { at: 1, speed: 2 }]
    expect(played(twice, 60)).toBeCloseTo(30)
    expect(sourceAt(twice, 60, 15)).toBeCloseTo(30)
  })

  test("the source frame at a time and the time a curve takes agree", () => {
    for (const [name, curve] of Object.entries(CURVES)) {
      const total = played(curve, 300)
      expect(sourceAt(curve, 300, total)).toBeCloseTo(300, 3)
      let before = -1
      for (let i = 0; i <= 20; i++) {
        const s = sourceAt(curve, 300, (total * i) / 20)
        expect(s, name).toBeGreaterThan(before)
        before = s
      }
    }
    // speeds stay in 0.1x to 10x whatever is asked
    expect(played([{ at: 0, speed: 1000 }, { at: 1, speed: 1000 }], 100)).toBeCloseTo(10)
    // the line drawn over a Bullet clip dips to its slow middle (0.3x) and stays in range
    const line = profile(CURVES.bullet, 300, 200)
    expect(Math.min(...line)).toBeLessThan(0.4)
    expect(Math.min(...line)).toBeGreaterThanOrEqual(0.3)
    expect(Math.max(...line)).toBeLessThanOrEqual(5)
  })
})

describe("TL4b: snapping, and TL0a: timecodes", () => {
  const t = { ...empty(30), markers: [{ id: "m", at: 200 }], tracks: [{ id: "main", kind: "main" as const, clips: [{ id: "a", kind: "video", start: 0, length: 90 }, { id: "b", kind: "video", start: 90, length: 60 }] }] }

  test("an edge snaps to the nearest clip edge, marker, beat or the playhead within reach, and says which", () => {
    const to = targets(t, { not: ["b"], playhead: 120, beats: [45] })
    expect(snap(93, to, 4)).toEqual({ frame: 90, to: { at: 90, what: "clip" } })
    expect(snap(118, to, 4).to?.what).toBe("playhead")
    expect(snap(47, to, 4).to?.what).toBe("beat")
    expect(snap(197, to, 4).to?.what).toBe("marker")
    expect(snap(160.4, to, 4)).toEqual({ frame: 160 })
    // a clip being moved doesn't snap to itself
    expect(to.some((x) => x.at === 150)).toBe(false)
  })

  test("a moved clip snaps by whichever edge is nearer a target", () => {
    const to = targets(t, { not: ["b"] })
    expect(snapMove(92, 60, to, 4)).toEqual({ by: -2, to: { at: 90, what: "clip" } })
    expect(snapMove(142, 60, to, 4).by).toBe(-2) // its end, at 202, to the marker at 200
    expect(snapMove(300, 60, to, 4)).toEqual({ by: 0 })
  })

  test("a timecode is drawn from frames", () => {
    expect([0, 29, 30, 1799, 1800, 4567].map((f) => timecode(f, 30))).toEqual(["00:00:00", "00:00:29", "00:01:00", "00:59:29", "01:00:00", "02:32:07"])
  })
})
