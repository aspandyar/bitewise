import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { deleteEntryAction, updateEntryAction } from "@/app/(app)/diary/actions";
import type { AmountInitial, PortionOption } from "@/components/diary/amount-fields";
import { EditEntryForm } from "@/components/diary/edit-entry-form";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { PageLoading } from "@/components/ui/page-loading";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { requireUserId } from "@/lib/auth/session";
import { DIARY_LIMITS } from "@/lib/config";
import { dayHref } from "@/lib/diary/paths";
import { getEntry } from "@/lib/diary/repo";
import { parseId } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { ru } from "@/lib/i18n/ru";
import { calcEntryNutrients } from "@/lib/nutrition";

async function EditEntryContent({ params }: Pick<PageProps<"/diary/entries/[id]/edit">, "params">) {
  const userId = await requireUserId();
  const entryId = parseId((await params).id);
  if (!entryId) notFound();
  const [entry, today] = await Promise.all([
    getEntry(db, userId, entryId),
    getUserToday(new Date()),
  ]);
  if (!entry) notFound();

  const portion: PortionOption | null =
    entry.portionLabel !== null && entry.portionGrams !== null
      ? {
          id: null,
          label: entry.portionLabel,
          grams: entry.portionGrams,
          kcal: calcEntryNutrients(entry, entry.portionGrams).kcal,
        }
      : null;
  const initial: AmountInitial = {
    mode: portion && entry.portionCount !== null ? "portion" : "grams",
    portionIndex: 0,
    count: entry.portionCount ?? DIARY_LIMITS.portionCount.default,
    grams: entry.grams,
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={dayHref(entry.date, today)} />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-foreground/60">{ru.diary.editTitle}</p>
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{entry.foodName}</h1>
      </div>
      {/* cacheComponents keeps hidden screens alive; keyed by the stored values so a revisit
          after saving never shows (and re-saves) the previous amount. */}
      <ResetOnHide>
        <EditEntryForm
          key={`${entry.id}:${entry.meal}:${entry.grams}:${entry.portionCount}`}
          action={updateEntryAction.bind(null, entry.id)}
          meal={entry.meal}
          portion={portion}
          initial={initial}
        />
      </ResetOnHide>
      <ConfirmDeleteButton action={deleteEntryAction.bind(null, entry.id)} />
    </main>
  );
}

export default function EditEntryPage({ params }: PageProps<"/diary/entries/[id]/edit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditEntryContent params={params} />
    </Suspense>
  );
}
