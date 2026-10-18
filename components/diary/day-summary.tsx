import { formatGrams, formatKcal, isOverTarget } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import type { DayProgress, NutrientProgress } from "@/lib/nutrition";

const macroRows = [
  { key: "proteinG", label: ru.targets.protein },
  { key: "fatG", label: ru.targets.fat },
  { key: "carbsG", label: ru.targets.carbs },
] as const;

// Numbers next to each bar carry the meaning; the bar is decoration for screen readers.
function Bar({ progress }: { progress: NutrientProgress }) {
  const over = isOverTarget(progress.remaining);
  return (
    <div aria-hidden className="h-2 overflow-hidden rounded-full bg-foreground/10">
      <div
        className={`h-full origin-left rounded-full ${over ? "bg-red-500" : "bg-accent"}`}
        style={{ transform: `scaleX(${Math.min(progress.share, 1)})` }}
      />
    </div>
  );
}

export function DaySummary({ progress }: { progress: DayProgress }) {
  const { kcal } = progress;
  const over = isOverTarget(kcal.remaining);
  return (
    <section
      aria-label={ru.diary.summaryTitle}
      className="flex flex-col gap-4 rounded-2xl border border-foreground/10 p-5"
    >
      <div className="flex flex-col gap-2">
        <p className="text-3xl font-semibold">
          {ru.diary.eatenOfTarget(formatKcal(kcal.eaten), formatKcal(kcal.target))}{" "}
          <span className="text-base font-normal">{ru.targets.kcalUnit}</span>
        </p>
        <p className={over ? "text-red-600 dark:text-red-400" : "text-foreground/60"}>
          {over
            ? ru.diary.over(formatKcal(-kcal.remaining))
            : ru.diary.remaining(formatKcal(kcal.remaining))}
        </p>
        <Bar progress={kcal} />
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {macroRows.map((row) => {
          const macro = progress[row.key];
          return (
            <div key={row.key} className="flex flex-col gap-1">
              <dt className="text-xs text-foreground/60">{row.label}</dt>
              <dd className="flex flex-col gap-1 text-sm font-medium">
                <span>
                  {ru.diary.eatenOfTarget(formatGrams(macro.eaten), formatGrams(macro.target))}{" "}
                  {ru.targets.gramsUnit}
                </span>
                <Bar progress={macro} />
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
