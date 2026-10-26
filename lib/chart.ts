export type Domain = readonly [number, number];

// A domain narrower than minSpan is widened around its middle, so a flat line is drawn flat
// in the middle of the chart instead of zig-zagging across its full height.
export function paddedDomain(values: readonly number[], minSpan: number): Domain | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min >= minSpan) return [min, max];
  const middle = (min + max) / 2;
  return [middle - minSpan / 2, middle + minSpan / 2];
}

// Floating division puts 0.3 / 0.1 at 2.9999…: without the slack the tick on the edge is lost.
const EDGE_SLACK = 1e-9;
const NICE_MULTIPLIERS = [1, 2, 5, 10] as const;

// Steps of 1, 2 or 5 × 10^k, so axis labels read as round numbers ("80 / 81 / 82") instead of
// the padded domain's own edges ("79,9 / 81,2 / 82,4"). Ticks stay inside the domain.
export function niceTicks(domain: Domain, maxTicks: number): number[] {
  const [lo, hi] = domain;
  if (!(hi > lo) || maxTicks < 2) return [];
  const rough = (hi - lo) / (maxTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    NICE_MULTIPLIERS.map((multiplier) => multiplier * magnitude).find((s) => s >= rough) ?? rough;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: number[] = [];
  const last = Math.floor(hi / step + EDGE_SLACK);
  for (let i = Math.ceil(lo / step - EDGE_SLACK); i <= last; i++) {
    ticks.push(Number((i * step).toFixed(decimals)));
  }
  return ticks;
}

export function linearScale(domain: Domain, range: Domain): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  // One point (or equal values) has no extent to stretch: it sits in the middle.
  if (d0 === d1) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}
