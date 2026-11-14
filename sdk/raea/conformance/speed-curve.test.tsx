// A <Video>'s or an <Audio>'s speed as a curve over its source (docs/timeline.feature TL6b): the source frame each
// frame shows, the rate its sound plays at, and how long the curve takes.
import { expect, test } from "bun:test";
import { Audio, Sequence, speedLength, Video } from "../src";
import { renderFrame } from "../src/test";

const base = { frame: 0, fps: 30, width: 1080, height: 1920, durationInFrames: 600 };
const attr = (html: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(html)?.[1];
const at = (frame: number, curve: [number, number][], more: object = {}) => {
  const html = renderFrame(<Video src="media/v.mp4" startFrom={30} endAt={150} speedCurve={curve} {...more} />, { ...base, frame });
  return { source: Number(attr(html, "data-source-frame")), rate: Number(attr(html, "data-playback-rate")), ended: attr(html, "data-ended") };
};

test("a flat curve is a playbackRate", () => {
  expect(at(10, [[0, 2], [1, 2]]).source).toBeCloseTo(50, 6);
  expect(at(10, [[0, 2], [1, 2]]).rate).toBeCloseTo(2, 6);
  expect(speedLength([[0, 2], [1, 2]], 120)).toBeCloseTo(60, 6);
});

test("the source moves faster where the curve is higher, and each frame's rate is the source it passes", () => {
  const curve: [number, number][] = [[0, 1], [0.5, 4], [1, 1]];
  const steps = Array.from({ length: 20 }, (_, f) => at(f, curve));
  for (let f = 0; f + 1 < steps.length; f++) {
    // the next frame's source is where this frame's rate takes it: the sound stays with the picture
    expect(steps[f + 1].source - steps[f].source).toBeCloseTo(steps[f].rate, 6);
    expect(steps[f + 1].rate).toBeGreaterThan(steps[f].rate);
  }
  expect(steps[0].source).toBe(30);
  expect(steps[0].rate).toBeGreaterThan(1);
});

test("it ends when the curve has played its source, holding the frame before endAt", () => {
  const curve: [number, number][] = [[0, 1], [1, 3]];
  const length = speedLength(curve, 120);
  expect(length).toBeCloseTo((120 * Math.log(3)) / 2, 6);
  expect(at(Math.floor(length) - 1, curve).ended).toBeUndefined();
  const after = at(Math.ceil(length), curve);
  expect(after.ended).toBe("true");
  expect(after.source).toBe(149);
});

test("a looped curve starts over", () => {
  const curve: [number, number][] = [[0, 2], [1, 2]];
  expect(at(70, curve, { loop: true }).source).toBeCloseTo(30 + 10 * 2, 6);
});

test("a fadeOut ends where the curve does", () => {
  const curve: [number, number][] = [[0, 2], [1, 2]];
  const vol = (frame: number) => Number(attr(renderFrame(<Sequence from={0} durationInFrames={300}><Audio src="media/a.wav" endAt={120} speedCurve={curve} fadeOut={1} /></Sequence>, { ...base, frame }), "data-volume"));
  expect(vol(20)).toBe(1);
  expect(vol(45)).toBeCloseTo(0.5, 6);
});

test("a curve needs endAt, and its points stay in range", () => {
  expect(() => renderFrame(<Video src="media/v.mp4" speedCurve={[[0, 1]]} />, base)).toThrow(/endAt/);
  expect(() => renderFrame(<Video src="media/v.mp4" endAt={60} speedCurve={[[0, 20]]} />, base)).toThrow(/speed/);
  expect(() => renderFrame(<Video src="media/v.mp4" endAt={60} speedCurve={[[2, 1]]} />, base)).toThrow(/place/);
});
