import Link from "next/link";
import { DIARY_LIMITS } from "@/lib/config";
import { addDays, type IsoDate } from "@/lib/date";
import { dayHref } from "@/lib/diary/paths";
import { formatDayLabel } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";

const arrow = "flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl";

function Arrow({ href, label, text }: { href: string | null; label: string; text: string }) {
  // The edge days keep the arrow's space so the date never jumps sideways.
  if (!href) {
    return (
      <span aria-hidden className={`${arrow} opacity-30`}>
        {text}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={arrow}>
      {text}
    </Link>
  );
}

export function DayNav({ date, today }: { date: IsoDate; today: IsoDate }) {
  const label = formatDayLabel(date, today);
  return (
    <nav aria-label={ru.diary.dayNav} className="flex items-center justify-between gap-2">
      <Arrow
        href={date > DIARY_LIMITS.minDate ? dayHref(addDays(date, -1), today) : null}
        label={ru.diary.prevDay}
        text={ru.diary.prevArrow}
      />
      <h1 className="text-xl font-semibold">
        {date === today ? (
          label
        ) : (
          <Link
            href="/"
            aria-label={ru.diary.backToToday(label)}
            className="flex min-h-11 items-center underline decoration-foreground/30"
          >
            {label}
          </Link>
        )}
      </h1>
      <Arrow
        href={date < today ? dayHref(addDays(date, 1), today) : null}
        label={ru.diary.nextDay}
        text={ru.diary.nextArrow}
      />
    </nav>
  );
}
