// A clip's speed as a curve over its source (docs/timeline.feature TL6b): [place, speed] points, the place from 0
// (its startFrom) to 1 (its endAt), the speed changing in a straight line over the source between two of them. So
// the frames a stretch of source takes, and the source frame at a frame, both have closed forms.
export type SpeedPoint = [place: number, speed: number];

/** The slowest and fastest a curve's point can be. */
export const SPEEDS = [0.1, 10] as const;

/** The points checked and in order, one at each end. */
export function speedPoints(owner: string, curve: SpeedPoint[]): SpeedPoint[] {
  if (!Array.isArray(curve) || !curve.length) throw new RangeError(`${owner}: speedCurve needs at least one [place, speed] point`);
  for (const p of curve) {
    if (!Array.isArray(p) || !(p[0] >= 0 && p[0] <= 1)) throw new RangeError(`${owner}: a speedCurve point's place runs from 0 to 1, got ${p?.[0]}`);
    if (!(p[1] >= SPEEDS[0] && p[1] <= SPEEDS[1])) throw new RangeError(`${owner}: a speedCurve point's speed runs from ${SPEEDS[0]} to ${SPEEDS[1]}, got ${p[1]}`);
  }
  const ps = [...curve].sort((a, b) => a[0] - b[0]);
  if (ps[0][0] > 0) ps.unshift([0, ps[0][1]]);
  if (ps[ps.length - 1][0] < 1) ps.push([1, ps[ps.length - 1][1]]);
  return ps;
}

// the frames a stretch of `len` source frames takes while the speed goes from `a` to `b` across it
const stretch = (len: number, a: number, b: number) => (Math.abs(b - a) < 1e-9 ? len / a : (len * Math.log(b / a)) / (b - a));

/** How many frames `span` source frames take under the curve (points from speedPoints). */
export function speedLength(ps: SpeedPoint[], span: number): number {
  let n = 0;
  for (let i = 0; i + 1 < ps.length; i++) n += stretch((ps[i + 1][0] - ps[i][0]) * span, ps[i][1], ps[i + 1][1]);
  return n;
}

/** The source frame, counted from the curve's start, showing `frame` frames in; `span` once the curve has run out. */
export function speedSource(ps: SpeedPoint[], span: number, frame: number): number {
  let left = Math.max(0, frame);
  for (let i = 0; i + 1 < ps.length; i++) {
    const len = (ps[i + 1][0] - ps[i][0]) * span;
    const a = ps[i][1], b = ps[i + 1][1];
    const all = stretch(len, a, b);
    if (left > all) {
      left -= all;
      continue;
    }
    // the speed over this stretch is a + k s (s source frames into it), so s frames in take ln((a + k s) / a) / k
    const k = len > 0 ? (b - a) / len : 0;
    return ps[i][0] * span + Math.min(len, Math.abs(k) < 1e-9 ? left * a : (a * Math.expm1(k * left)) / k);
  }
  return span;
}
