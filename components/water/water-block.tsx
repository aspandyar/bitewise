import { addWaterAction, removeWaterAction } from "@/app/(app)/diary/water-actions";
import { WATER } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { formatNumber } from "@/lib/i18n/number";
import { ru } from "@/lib/i18n/ru";
import type { DayWater } from "@/lib/water/repo";
import { calcWaterShare } from "@/lib/water/schema";
import { WaterButton } from "./water-button";

export function WaterBlock({ date, water }: { date: IsoDate; water: DayWater }) {
  const share = calcWaterShare(water.totalMl, WATER.dailyTargetMl);
  return (
    <section
      aria-label={ru.water.title}
      className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{ru.water.title}</h2>
        <p className="text-sm text-foreground/60">
          {ru.water.ofTarget(formatNumber(water.totalMl), formatNumber(WATER.dailyTargetMl))}
        </p>
      </div>
      {/* The numbers above carry the meaning; the bar is decoration for screen readers. */}
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full origin-left rounded-full bg-accent"
          style={{ transform: `scaleX(${share})` }}
        />
      </div>
      {/* One form, so a pending "+500" also holds "Убрать последнее": tapped before the answer,
          it would remove the glass before, whose id this render still carries (#123). */}
      <form className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {WATER.quickMl.map((ml) => (
            <WaterButton key={ml} action={addWaterAction.bind(null, date, ml)} keyed primary>
              {ru.water.add(formatNumber(ml))}
            </WaterButton>
          ))}
        </div>
        {water.lastId && (
          <WaterButton action={removeWaterAction.bind(null, water.lastId, date)}>
            {ru.water.removeLast}
          </WaterButton>
        )}
      </form>
    </section>
  );
}
