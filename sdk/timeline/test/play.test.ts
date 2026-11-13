import { describe, expect, test } from "bun:test"
import { apply, frameOf, fromRender, next, playLength, ready, showing, type Timeline } from "../src"

const done = (t: Timeline, op: Parameters<typeof apply>[1]) => {
  const r = apply(t, op)
  if (!r.ok) throw new Error(r.why)
  return r.timeline
}
// a 10 s film at 30 fps cut at 3 s and 6 s
const film = () => fromRender({ frames: 300, fps: 30, cuts: [90, 180] })

describe("TL10a: an edited film plays from its own frames, with no render", () => {
  test("unedited, each frame shows itself", () => {
    const t = film()
    expect(showing(t, 0)).toMatchObject({ source: 0, rate: 1 })
    expect(showing(t, 200)).toMatchObject({ source: 200, rate: 1 })
    expect(showing(t, 300)).toBeUndefined()
    expect(playLength(t)).toBe(300)
  })

  test("a scene removed: the film is shorter and plays on from the next scene's frames", () => {
    const t = done(film(), { op: "remove", ids: ["scene-2"] })
    expect(playLength(t)).toBe(210)
    expect(showing(t, 89)).toMatchObject({ source: 89 })
    expect(showing(t, 90)).toMatchObject({ source: 180, clip: { id: "scene-3" } })
    // the player, playing scene 1, reaches its end at frame 90: it goes to the next clip there
    expect(next(t, 90)).toBe(90)
    expect(next(t, 210)).toBeUndefined()
  })

  test("scenes swapped and one sped up: source frames, the rate, and the way back from the player's time", () => {
    let t = done(film(), { op: "move", ids: ["scene-1"], by: 100 })
    expect(t.tracks[0].clips.map((c) => c.id)).toEqual(["scene-2", "scene-1", "scene-3"])
    expect(showing(t, 0)).toMatchObject({ source: 90 })
    expect(showing(t, 100)).toMatchObject({ source: 10, clip: { id: "scene-1" } })
    t = done(t, { op: "set", id: "scene-1", set: { speed: 2 } })
    expect(showing(t, 100)).toMatchObject({ source: 20, rate: 2 })
    expect(frameOf(t, "scene-1", 20)).toBe(100)
    expect(frameOf(t, "scene-1", 250)).toBeUndefined()
  })

  test("what is ready to play follows the clips: the file's buffered frames, where the edit put them", () => {
    const t = done(film(), { op: "remove", ids: ["scene-2"] })
    // the file is buffered from 0 to 4 s and 7 to 10 s
    expect(ready(t, [[0, 120], [210, 300]])).toEqual([[0, 90], [120, 210]])
    expect(ready(film(), [[0, 300]])).toEqual([[0, 300]])
  })
})
