// check: frames 0,45,89
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from "raea";
import { applyAll, empty, end, length, valueAt, type Clip, type Op, type Timeline } from "raea/editor";

// A timeline made in code and edited by operations, as the feed's editor and an agent's script both edit one: two
// shots on the main track and a title over them.
const before: Timeline = {
  ...empty(30),
  tracks: [
    { id: "text", kind: "text", clips: [{ id: "title", kind: "text", name: "Title", start: 0, length: 60 }] },
    {
      id: "main",
      kind: "main",
      clips: [
        { id: "a", kind: "video", name: "Shot A", start: 0, length: 90, in: 0, source: 300 },
        { id: "b", kind: "video", name: "Shot B", start: 90, length: 90, in: 0, source: 300 },
      ],
    },
  ],
};

// Shot A split at one second, and the title faded in by two keys on its opacity.
const first: Op[] = [
  { op: "split", at: 30, ids: ["a"] },
  { op: "key", id: "title", prop: "opacity", at: 0, value: 0, ease: [0.42, 0, 0.58, 1] },
  { op: "key", id: "title", prop: "opacity", at: 20, value: 1 },
];
const cut = applyAll(before, first);
// The half the split made is found where it starts, and played twice as fast: the main track's magnet closes the
// gap, so Shot B comes in earlier.
const half = cut.timeline.tracks[1].clips.find((c) => c.start === 30)!;
const after = applyAll(cut.timeline, [{ op: "set", id: half.id, set: { speed: 2 } }]);
// Every operation gives back its inverse: applied last first, they put the timeline back as it was.
const undone = applyAll(after.timeline, [...after.inverse, ...cut.inverse]).timeline;

const SCALE = 5; // px a frame
const COLOR: Record<string, string> = { video: "#3d7bd9", text: "#c9853d" };

function Row({ clips, top, frame }: { clips: Clip[]; top: number; frame: number }) {
  return (
    <>
      {clips.map((c) => {
        const on = frame >= c.start && frame < end(c);
        const opacity = typeof valueAt(c.keys?.opacity, frame - c.start) === "number" ? (valueAt(c.keys?.opacity, frame - c.start) as number) : 1;
        return (
          <div
            key={c.id}
            style={{ position: "absolute", left: 80 + c.start * SCALE, top, width: c.length * SCALE - 4, height: 64, borderRadius: 8, background: COLOR[c.kind] ?? "#777", opacity: on ? Math.max(0.35, opacity) : 0.35, color: "#fff", fontSize: 26, padding: "16px 14px", boxSizing: "border-box", overflow: "hidden", whiteSpace: "nowrap" }}
          >
            {c.name}
            {c.speed && c.speed !== 1 ? ` · ${c.speed}x` : ""}
          </div>
        );
      })}
    </>
  );
}

function Edits() {
  const frame = useCurrentFrame();
  const label = (y: number, text: string) => <div style={{ position: "absolute", left: 80, top: y, color: "#aaa", fontSize: 28 }}>{text}</div>;
  return (
    <AbsoluteFill style={{ background: "#16181c", fontFamily: "sans-serif" }}>
      {label(100, `Before: ${length(before)} frames`)}
      <Row clips={before.tracks[0].clips} top={144} frame={frame} />
      <Row clips={before.tracks[1].clips} top={218} frame={frame} />
      {label(330, `After ${first.length + 1} edits: ${length(after.timeline)} frames`)}
      <Row clips={after.timeline.tracks[0].clips} top={374} frame={frame} />
      <Row clips={after.timeline.tracks[1].clips} top={448} frame={frame} />
      {label(560, `Undone: ${JSON.stringify(undone) === JSON.stringify(before) ? "as it was" : "changed"}`)}
      <div style={{ position: "absolute", left: 80 + frame * SCALE, top: 134, width: 3, height: 392, background: "#ff4d4d" }} />
    </AbsoluteFill>
  );
}

registerRoot(() => <Composition id="edits" component={Edits} width={1280} height={720} fps={30} durationInFrames={90} />);
