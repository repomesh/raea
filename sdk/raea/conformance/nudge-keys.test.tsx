// <Nudge keys>: a placed part's properties over time, as the timeline writes them (docs/timeline.feature TL5d).
import { describe, expect, test } from "bun:test";
import { keyedAt, Nudge, type NudgeKey } from "@raea/video/nudge";
import { Sequence } from "../src";
import { renderFrame } from "../src/test";

const opts = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };

describe("a keyed property's value at a frame", () => {
  const scale: NudgeKey[] = [[10, 1], [40, 2]];

  test("holds before its first key and after its last, and travels in a straight line between", () => {
    expect([0, 10, 25, 40, 99].map((f) => keyedAt(scale, f))).toEqual([1, 1, 1.5, 2, 2]);
  });

  test("follows the first key's ease: hold stays then jumps, a bezier is CSS's", () => {
    expect(keyedAt([[10, 1, "hold"], [40, 2]], 39)).toBe(1);
    expect(keyedAt([[10, 1, "hold"], [40, 2]], 40)).toBe(2);
    const eased = keyedAt([[0, 0, [0.42, 0, 0.58, 1]], [100, 1]], 25);
    expect(eased).toBeCloseTo(0.1292, 3);
    // a handle above the graph overshoots
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => keyedAt([[0, 0, [0.3, 1.6, 0.6, 1]], [49, 1]], i)))).toBeGreaterThan(1);
  });

  test("keys are read in time order whatever order they are written in", () => {
    expect(keyedAt([[40, 2], [10, 1]], 25)).toBe(1.5);
  });

  test("in a <Sequence> the keys run from the sequence's first frame, and a keyed property wins over its still value", () => {
    const at = (frame: number) => renderFrame(<Sequence from={50}><Nudge scale={3} keys={{ scale: [[0, 1], [30, 2]], opacity: [[0, 0], [10, 1]] }}><div>hi</div></Nudge></Sequence>, { ...opts, frame });
    expect(at(50)).toContain("opacity:0");
    expect(at(55)).toContain("opacity:0.5");
    expect(at(65)).toContain("scale(1.5)");
    expect(at(80)).toContain("scale(2)");
    expect(at(80)).not.toContain("scale(3)");
    // with no keys it is the still Nudge it was
    expect(renderFrame(<Nudge scale={3}><div>hi</div></Nudge>, { ...opts, frame: 0 })).toContain("scale(3)");
  });
});

describe("a placed part mirrored and cropped (docs/timeline.feature TL3h)", () => {
  const at = (el: JSX.Element) => renderFrame(el, { ...opts, frame: 0 });

  test("mirror flips it left to right, with its scale", () => {
    expect(at(<Nudge mirror><div>hi</div></Nudge>)).toContain("transform:scale(-1, 1)");
    expect(at(<Nudge mirror scale={2} x={10}><div>hi</div></Nudge>)).toContain("transform:translate(10px, 0px) scale(-2, 2)");
  });

  test("crop cuts each side off by its share, on an element and on a component's layer", () => {
    expect(at(<Nudge crop={[0.1, 0, 0, 0.25]}><div>hi</div></Nudge>)).toContain("clip-path:inset(0% 0% 25% 10%)");
    const Part = () => <p>part</p>;
    expect(at(<Nudge crop={[0, 0.5, 0, 0]}><Part /></Nudge>)).toContain("clip-path:inset(50% 0% 0% 0%)");
    // no crop, no clip
    expect(at(<Nudge crop={[0, 0, 0, 0]}><div>hi</div></Nudge>)).not.toContain("clip-path");
  });

  test("a crop out of range fails", () => {
    expect(() => at(<Nudge crop={[1, 0, 0, 0]}><div>hi</div></Nudge>)).toThrow(/crop/);
    expect(() => at(<Nudge crop={[0, 0, 0] as unknown as [number, number, number, number]}><div>hi</div></Nudge>)).toThrow(/crop/);
  });
});
