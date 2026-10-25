import { CHART, WEIGHT } from "@/lib/config";
import type { WeightPoint } from "@/lib/body";
import { linearScale, paddedDomain } from "@/lib/chart";
import { daysBetween, type IsoDate } from "@/lib/date";
import { formatShortDate, formatWeightKg } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";

const { width, height, padding, dotRadius, labelGap } = CHART;

// Drawn on the server: two lines of SVG need no chart library on the phone.
export function WeightChart({
  points,
  from,
  to,
}: {
  points: readonly WeightPoint[];
  from: IsoDate;
  to: IsoDate;
}) {
  const domain = paddedDomain(
    points.flatMap((point) => [point.weightKg, point.averageKg]),
    WEIGHT.chartMinSpanKg,
  );
  const first = points[0];
  const last = points.at(-1);
  if (!domain || !first || !last) return null;
  const x = linearScale([0, daysBetween(from, to)], [padding.left, width - padding.right]);
  const y = linearScale(domain, [height - padding.bottom, padding.top]);
  const xOf = (date: IsoDate) => x(daysBetween(from, date));
  const ticks = [domain[0], (domain[0] + domain[1]) / 2, domain[1]];
  const averageLine = points.map((point) => `${xOf(point.date)},${y(point.averageKg)}`).join(" ");

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ru.body.chartSummary(
          formatWeightKg(first.weightKg),
          formatWeightKg(last.weightKg),
          formatWeightKg(last.averageKg),
        )}
        className="w-full text-foreground"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-foreground/10"
            />
            <text
              x={padding.left - labelGap}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-foreground/60 text-[10px]"
            >
              {formatWeightKg(tick)}
            </text>
          </g>
        ))}
        <text x={padding.left} y={height - labelGap} className="fill-foreground/60 text-[10px]">
          {formatShortDate(from)}
        </text>
        <text
          x={width - padding.right}
          y={height - labelGap}
          textAnchor="end"
          className="fill-foreground/60 text-[10px]"
        >
          {formatShortDate(to)}
        </text>
        {points.length > 1 && (
          <polyline
            points={averageLine}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            className="stroke-accent"
          />
        )}
        {points.map((point) => (
          <circle
            key={point.date}
            cx={xOf(point.date)}
            cy={y(point.weightKg)}
            r={dotRadius}
            className="fill-foreground/50"
          />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-foreground/50" />
          {ru.body.legendWeight}
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-accent" />
          {ru.body.legendAverage}
        </span>
      </figcaption>
    </figure>
  );
}
