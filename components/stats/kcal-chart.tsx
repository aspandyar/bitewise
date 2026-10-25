import { CHART } from "@/lib/config";
import { linearScale } from "@/lib/chart";
import { daysBetween, type IsoDate } from "@/lib/date";
import { formatKcal, formatShortDate } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { isDayInTarget, type DayTotals } from "@/lib/nutrition";

const {
  width,
  height,
  padding,
  barGap,
  barRadius,
  minBarWidth,
  headroom,
  labelGap,
  labelFontSize,
  targetDash,
} = CHART;
const labelStyle = { fontSize: labelFontSize };

// One slot per calendar day of the period; a day without entries stays an empty slot, so gaps
// read as "not tracked" rather than as a low day.
export function KcalChart({
  days,
  from,
  to,
  targetKcal,
  averageKcal,
}: {
  days: readonly DayTotals[];
  from: IsoDate;
  to: IsoDate;
  targetKcal: number;
  averageKcal: number;
}) {
  const slots = daysBetween(from, to) + 1;
  const band = (width - padding.left - padding.right) / slots;
  const top = Math.max(targetKcal, ...days.map((day) => day.nutrients.kcal)) * headroom;
  const y = linearScale([0, top], [height - padding.bottom, padding.top]);
  const baseline = y(0);
  const targetY = y(targetKcal);

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ru.stats.chartSummary(
          days.length,
          formatKcal(averageKcal),
          formatKcal(targetKcal),
        )}
        className="w-full"
      >
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={baseline}
          y2={baseline}
          className="stroke-foreground/20"
        />
        {days.map((day) => {
          const barTop = y(day.nutrients.kcal);
          return (
            <rect
              key={day.date}
              x={padding.left + daysBetween(from, day.date) * band + barGap / 2}
              y={barTop}
              width={Math.max(band - barGap, minBarWidth)}
              height={baseline - barTop}
              rx={barRadius}
              className={
                isDayInTarget(day.nutrients.kcal, targetKcal) ? "fill-accent" : "fill-foreground/30"
              }
            />
          );
        })}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={targetY}
          y2={targetY}
          strokeDasharray={targetDash}
          className="stroke-foreground/60"
        />
        <text
          x={padding.left - labelGap}
          y={targetY}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-foreground/60"
          style={labelStyle}
        >
          {formatKcal(targetKcal)}
        </text>
        <text
          x={padding.left}
          y={height - labelGap}
          className="fill-foreground/60"
          style={labelStyle}
        >
          {formatShortDate(from)}
        </text>
        <text
          x={width - padding.right}
          y={height - labelGap}
          textAnchor="end"
          className="fill-foreground/60"
          style={labelStyle}
        >
          {formatShortDate(to)}
        </text>
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-sm bg-accent" />
          {ru.stats.legendInTarget}
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-sm bg-foreground/30" />
          {ru.stats.legendOffTarget}
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="w-3 border-t border-dashed border-foreground/60" />
          {ru.stats.legendTarget}
        </span>
      </figcaption>
    </figure>
  );
}
