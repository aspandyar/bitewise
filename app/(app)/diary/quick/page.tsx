import { notFound } from "next/navigation";
import { Suspense } from "react";
import { addQuickEntryAction } from "@/app/(app)/diary/actions";
import { QuickEntryForm } from "@/components/diary/quick-entry-form";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { requireUserId } from "@/lib/auth/session";
import { addHref } from "@/lib/diary/paths";
import { parseEntryContext } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { formatDayLabel } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";

async function QuickContent({ searchParams }: Pick<PageProps<"/diary/quick">, "searchParams">) {
  await requireUserId();
  const today = await getUserToday(new Date());
  const params = await searchParams;
  const entry = parseEntryContext(params.date, params.meal, today);
  if (!entry) notFound();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={addHref(entry.date, entry.meal)} />
      <div className="flex flex-col gap-1">
        {entry.date === today ? null : (
          <p className="text-sm font-medium">
            {ru.diary.entryDay(formatDayLabel(entry.date, today))}
          </p>
        )}
        <h1 className="text-2xl font-semibold">{ru.diary.quickTitle}</h1>
      </div>
      {/* cacheComponents keeps hidden screens alive: half-typed numbers must not come back. */}
      <ResetOnHide>
        <QuickEntryForm
          key={`${entry.date}:${entry.meal}`}
          action={addQuickEntryAction}
          date={entry.date}
          meal={entry.meal}
          submitLabel={ru.diary.submitAdd}
        />
      </ResetOnHide>
    </main>
  );
}

export default function QuickEntryPage({ searchParams }: PageProps<"/diary/quick">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <QuickContent searchParams={searchParams} />
    </Suspense>
  );
}
