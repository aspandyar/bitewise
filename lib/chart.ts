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

export function linearScale(domain: Domain, range: Domain): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  // One point (or equal values) has no extent to stretch: it sits in the middle.
  if (d0 === d1) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}
