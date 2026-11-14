import { describe, expect, test } from "bun:test"
import { apply, clipEdits, fromRender, fromSequences, fromTracks, readTimeline, segmentsOf, seqEdits, type Timeline } from "../src"

const done = (t: Timeline, op: Parameters<typeof apply>[1]) => {
  const r = apply(t, op)
  if (!r.ok) throw new Error(r.why)
  return r.timeline
}

describe("TL0c: a timeline is read from a composition", () => {
  const rows = [
    { i: 0, name: "Sequence", label: "First scene", from: 0, to: 90, lane: 0 },
    { i: 3, name: "Sequence", label: "Second scene", from: 90, to: 180, lane: 0 },
    { i: 1, name: "Sequence", label: "Title", from: 15, to: 60, lane: 1 },
    { i: 5, name: "Sequence", label: "Outro", from: 150, to: 180, lane: 1, locked: "set in code" },
  ]

  test("a lane is a track; a first lane with no gap from frame 0 is the main track, its magnet on", () => {
    const t = fromSequences(rows, 30)
    expect(t.tracks.map((k) => [k.id, k.kind, k.clips.map((c) => `${c.name} ${c.start}+${c.length}`)])).toEqual([
      ["main", "main", ["First scene 0+90", "Second scene 90+90"]],
      ["overlay-1", "overlay", ["Title 15+45", "Outro 150+30"]],
    ])
    expect(t.magnet).toBe(true)
    expect(t.tracks[1].clips[1].locked).toBe("set in code")
    // a gap in the first lane: it is where the code put it, no magnet
    const gapped = fromSequences([{ ...rows[0], to: 80 }, rows[1]], 30)
    expect([gapped.magnet, gapped.tracks[0].kind]).toEqual([false, "overlay"])
  })

  test("an operation on it is the host's edit to those elements", () => {
    const t = fromSequences(rows, 30)
    expect(seqEdits(t, { op: "move", ids: ["seq-1"], by: 10 })).toEqual([{ op: "move", i: 1, from: 25, to: 70 }])
    expect(seqEdits(t, { op: "trim", id: "seq-3", edge: "start", to: 100 })).toEqual([{ op: "move", i: 3, from: 100, to: 180 }])
    expect(seqEdits(t, { op: "trim", id: "seq-0", edge: "end", to: 75 })).toEqual([{ op: "move", i: 0, from: 0, to: 75 }])
    // every clip under the playhead that can be changed, the later one first
    expect(seqEdits(t, { op: "split", at: 45 })).toEqual([{ op: "split", i: 1, at: 45 }, { op: "split", i: 0, at: 45 }])
    expect(seqEdits(t, { op: "remove", ids: ["seq-0", "seq-3"] })).toEqual([{ op: "delete", i: 3 }, { op: "delete", i: 0 }])
    // a speed is the footage's rate; another field of a clip isn't a sequence's to take
    expect(seqEdits(t, { op: "set", id: "seq-0", set: { speed: 2 } })).toEqual([{ op: "speed", i: 0, speed: 2 }])
    expect(seqEdits(t, { op: "set", id: "seq-0", set: { volume: 0.5 } })).toEqual({ why: "the composition's sequences take a speed, not volume, yet" })
    expect(seqEdits(t, { op: "duplicate", ids: ["seq-0"] })).toEqual({ why: 'the composition\'s sequences don\'t take "duplicate" yet' })
    expect(fromSequences([{ ...rows[0], speed: 2 }], 30).tracks[0].clips[0].speed).toBe(2)
  })

  test("a <Video> and an <Audio> are clips of their own under their sequence: their level is theirs, the rest the sequence's", () => {
    const t = fromSequences([...rows, { i: 4, name: "Video", label: "take.mp4", from: 90, to: 180, lane: 0, media: "video", startFrom: 30 }, { i: 6, name: "Audio", label: "bed.wav", from: 0, to: 180, lane: 0, media: "audio", volume: 0.5 }], 30)
    expect(t.tracks.map((k) => [k.id, k.kind, k.clips.map((c) => c.name)])).toEqual([
      ["main", "main", ["First scene", "Second scene"]],
      ["overlay-1", "overlay", ["Title", "Outro"]],
      ["footage-1", "overlay", ["take.mp4"]],
      ["sound-1", "sound", ["bed.wav"]],
    ])
    expect(t.tracks[2].clips[0]).toMatchObject({ kind: "video", in: 30, start: 90, length: 90 })
    expect(t.tracks[3].clips[0]).toMatchObject({ kind: "audio", volume: 0.5 })
    expect(seqEdits(t, { op: "set", id: "seq-6", set: { volume: 0.8 } })).toEqual([{ op: "level", i: 6, volume: 0.8 }])
    expect(seqEdits(t, { op: "move", ids: ["seq-6"], by: 10 })).toEqual({ why: "footage and sound play where their sequence does: move, trim or speed the sequence; here only the level is its own" })
    // the sequences themselves are as before
    expect(seqEdits(t, { op: "move", ids: ["seq-1"], by: 10 })).toEqual([{ op: "move", i: 1, from: 25, to: 70 }])
  })

  test("a transition on a cut is the part before going out and the part after coming in, and is read back from them", () => {
    const t = fromSequences(rows, 30)
    expect(seqEdits(t, { op: "transition", transition: { id: "x-seq-0", kind: "slide", after: "seq-0", length: 15 } })).toEqual([
      { op: "edge", i: 0, side: "out", kind: "slide", frames: 8 },
      { op: "edge", i: 3, side: "in", kind: "slide", frames: 7 },
    ])
    const cut = fromSequences([{ ...rows[0], out: { kind: "slide", frames: 8 } }, { ...rows[1], in: { kind: "slide", frames: 7 } }], 30)
    expect(cut.transitions).toEqual([{ id: "x-seq-0", kind: "slide", after: "seq-0", length: 15 }])
    expect(seqEdits(cut, { op: "untransition", id: "x-seq-0" })).toEqual([
      { op: "edge", i: 0, side: "out", kind: "slide", frames: 0 },
      { op: "edge", i: 3, side: "in", kind: "slide", frames: 0 },
    ])
    // a kind the composition's <Transition> doesn't draw, and a part with nothing after it
    expect(seqEdits(t, { op: "transition", transition: { id: "x", kind: "Glitch", after: "seq-0", length: 15 } })).toEqual({ why: 'a composition draws fade, slide, wipe, zoom: "Glitch" isn\'t one its <Transition> has' })
    expect(seqEdits(t, { op: "transition", transition: { id: "x", kind: "fade", after: "seq-3", length: 15 } })).toEqual({ why: "a transition sits on a cut between two of the composition's sequences" })
  })

  test("a key on a sequence is its <Nudge>'s keys, written whole; what the wrapper can't key is refused", () => {
    const keyed = fromSequences([{ ...rows[0], keys: { scale: [[0, 1], [45, 1.2, [0.2, 0, 0, 1]]] } }, rows[1]], 30)
    expect(keyed.tracks[0].clips[0].keys).toEqual({ scale: [{ at: 0, value: 1 }, { at: 45, value: 1.2, ease: [0.2, 0, 0, 1] }] })
    expect(seqEdits(keyed, { op: "key", id: "seq-0", prop: "opacity", at: 10, value: 0.5 })).toEqual([{ op: "keys", i: 0, keys: { scale: [[0, 1], [45, 1.2, [0.2, 0, 0, 1]]], opacity: [[10, 0.5]] } }])
    expect(seqEdits(keyed, { op: "ease", id: "seq-0", prop: "scale", at: 0, ease: "hold" })).toEqual([{ op: "keys", i: 0, keys: { scale: [[0, 1, "hold"], [45, 1.2, [0.2, 0, 0, 1]]] } }])
    expect(seqEdits(keyed, { op: "unkey", id: "seq-0", prop: "scale", at: 45 })).toEqual([{ op: "keys", i: 0, keys: { scale: [[0, 1]] } }])
    expect(seqEdits(keyed, { op: "key", id: "seq-0", prop: "blur", at: 0, value: 1 })).toEqual({ why: "a sequence keys its x, y, scale, rotate, opacity: blur is its own code's" })
  })
})

describe("TL14a: a film with no composition is its scenes and its sound", () => {
  test("scenes cut where the picture cuts, and the cut they make after edits", () => {
    const t = fromRender({ frames: 300, fps: 30, cuts: [90, 210, 210, 400] })
    expect(t.tracks[0].clips.map((c) => [c.id, c.start, c.length])).toEqual([["scene-1", 0, 90], ["scene-2", 90, 120], ["scene-3", 210, 90]])
    expect(t.tracks.length).toBe(1)
    expect(segmentsOf(t)).toEqual([[0, 90], [90, 210], [210, 300]])
    // the second scene removed, the third trimmed by 30 frames at its start, then moved first
    let cut = done(t, { op: "remove", ids: ["scene-2"] })
    cut = done(cut, { op: "trim", id: "scene-3", edge: "start", to: 120 })
    cut = done(cut, { op: "move", ids: ["scene-3"], by: -120 })
    expect(segmentsOf(cut)).toEqual([[240, 300], [0, 90]])
  })
})

describe("TL14b: a sound in the feed is its tracks", () => {
  const tracks = [
    { id: "music", name: "Music", kind: "clips" as const, bus: "music", clips: [{ id: "bed", from: 0, to: 8, label: "bed.wav", src: "audio/bed.wav", offset: 1, gainDb: -6 }] },
    { id: "lead", name: "Lead", kind: "notes" as const, bus: "music", clips: [{ id: "lead-1", from: 2, to: 6, label: "Lead" }] },
  ]

  test("a file clip keeps its place in its file and its level; notes are shown and edited on their roll", () => {
    const t = fromTracks(tracks, 30)
    expect(t.magnet).toBe(false)
    expect(t.tracks[0].clips[0]).toMatchObject({ id: "bed", kind: "audio", start: 0, length: 240, in: 30, at: "audio/bed.wav", volume: 0.501 })
    expect(t.tracks[1].clips[0]).toMatchObject({ kind: "notes", locked: "edited on its roll" })
    expect(apply(t, { op: "move", ids: ["lead-1"], by: 10 })).toEqual({ ok: false, why: "Lead is edited on its roll" })
  })

  test("a clip moved, trimmed and turned up is the host's clip edit, in seconds and dB", () => {
    const t = fromTracks(tracks, 30)
    let now = done(t, { op: "move", ids: ["bed"], by: 30 })
    now = done(now, { op: "trim", id: "bed", edge: "start", to: 60 })
    now = done(now, { op: "set", id: "bed", set: { volume: 1 } })
    expect(clipEdits(t, now)).toEqual([{ id: "bed", src: "audio/bed.wav", from: { start: 0, end: 8, offset: 1, gainDb: -6 }, to: { start: 2, end: 9, offset: 2, gainDb: 0 } }])
    expect(clipEdits(t, t)).toEqual([])
  })
})

describe("TL0d: a feed item or a controller declares a timeline of its own data", () => {
  test("what is well formed is a timeline the editor takes; the rest is said", () => {
    const { timeline, errors } = readTimeline({
      fps: 1,
      tracks: [
        { id: "stage", kind: "main", name: "Main stage", clips: [{ id: "doors", name: "Doors", start: 0, length: 1800 }, { id: "set-1", name: "First set", start: 1800.4, length: 2700 }] },
        { name: "Bar", clips: [{ id: "happy", start: 0, length: 3600, props: { price: 5 } }, { id: "doors", start: 10, length: 5 }, { start: 0, length: 5 }, { id: "bad", start: -5, length: 0 }] },
      ],
      markers: [{ at: 1800, name: "Curfew" }],
    })
    expect(timeline!.fps).toBe(1)
    expect(timeline!.tracks.map((k) => [k.id, k.kind, k.name, k.clips.map((c) => `${c.id} ${c.start}+${c.length}`)])).toEqual([
      ["stage", "main", "Main stage", ["doors 0+1800", "set-1 1800+2700"]],
      ["track-2", "overlay", "Bar", ["happy 0+3600"]],
    ])
    expect(timeline!.tracks[1].clips[0].props).toEqual({ price: 5 })
    expect(timeline!.markers).toEqual([{ id: "m1", at: 1800, name: "Curfew" }])
    expect(timeline!.magnet).toBe(false)
    expect(errors).toEqual(["tracks[1].clips[1]: the id doors is used twice", "tracks[1].clips[2] has no id", "tracks[1].clips[3] (bad) starts at 0 or later and is one frame or longer"])
    // and it is edited as any other
    expect(done(timeline!, { op: "move", ids: ["set-1"], by: 600 }).tracks[0].clips[1].start).toBe(2400)
  })

  test("what isn't a timeline says what one is", () => {
    expect(readTimeline("x").errors[0]).toContain("a timeline is an object")
    expect(readTimeline({ fps: 30 })).toEqual({ errors: ["tracks is a list of { id, kind, clips }"] })
  })
})
