// <Effect>: a look on the picture under it for its part's frames (docs/timeline.feature TL7b).
import { expect, test } from "bun:test";
import { AbsoluteFill, Effect, EFFECTS, effectAt, effectFilter, Sequence } from "../src";
import { renderFrame } from "../src/test";

const base = { frame: 0, fps: 30, width: 1080, height: 1920, durationInFrames: 90 };
const at = (frame: number, el: JSX.Element) => renderFrame(<AbsoluteFill><div>under</div><Sequence from={30} durationInFrames={30}>{el}</Sequence></AbsoluteFill>, { ...base, frame });

test("an effect is on for its sequence's frames, as a filter on what is behind it", () => {
  expect(at(10, <Effect kind="mono" />)).not.toContain("data-effect");
  const on = at(40, <Effect kind="mono" />);
  expect(on).toContain('data-effect="mono"');
  expect(on).toContain("backdrop-filter:grayscale(1)");
  expect(at(70, <Effect kind="mono" />)).not.toContain("data-effect");
});

test("its amount scales it, and it comes on and goes off over the frames it is given", () => {
  expect(at(40, <Effect kind="blur" amount={0.5} />)).toContain("backdrop-filter:blur(12px)");
  // 10 frames in: a tenth on its first frame, all of it from its tenth; 10 frames out: a tenth on its last
  expect(at(30, <Effect kind="mono" in={10} />)).toContain("backdrop-filter:grayscale(0.1)");
  expect(at(39, <Effect kind="mono" in={10} />)).toContain("backdrop-filter:grayscale(1)");
  expect(at(59, <Effect kind="mono" out={10} />)).toContain("backdrop-filter:grayscale(0.1)");
  expect(effectAt(0, 30, 10, 10)).toBeCloseTo(0.1, 6);
  expect(effectAt(15, 30, 10, 10)).toBe(1);
});

test("every kind gives a filter, none at amount 0 changes the picture's numbers, and an unknown kind fails", () => {
  for (const e of EFFECTS) expect(effectFilter(e.kind, 1)).toMatch(/^[a-z-]+\(/);
  expect(effectFilter("vivid", 0)).toBe("saturate(1) contrast(1)");
  expect(effectFilter("nope")).toBeUndefined();
  expect(() => at(40, <Effect kind="nope" />)).toThrow(/kind is one of/);
  expect(() => at(40, <Effect kind="blur" amount={2} />)).toThrow(/amount/);
});
