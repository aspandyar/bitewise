import Link from "next/link";
import type { Meal } from "@/lib/config";
import { addDays, type IsoDate } from "@/lib/date";
import { addHref } from "@/lib/diary/paths";
import { ru } from "@/lib/i18n/ru";

const segment =
  "flex min-h-11 flex-1 items-center justify-center rounded-lg border border-foreground/40 px-3 aria-[current=page]:border-accent aria-[current=page]:bg-accent/10 aria-[current=page]:font-medium";

// Food eaten after midnight goes to yesterday in one tap; older days are reached from the day view.
export function DaySwitch({ date, today, meal }: { date: IsoDate; today: IsoDate; meal: Meal }) {
  const yesterday = addDays(today, -1);
  if (date !== today && date !== yesterday) return null;
  return (
    <nav aria-label={ru.diary.daySwitch} className="flex gap-2">
      {[
        { day: today, label: ru.diary.today },
        { day: yesterday, label: ru.diary.yesterday },
      ].map(({ day, label }) => (
        <Link
          key={day}
          href={addHref(day, meal)}
          aria-current={day === date ? "page" : undefined}
          className={segment}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
