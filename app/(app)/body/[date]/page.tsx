import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { deleteWeightAction, saveWeightAction } from "@/app/(app)/body/actions";
import { WeightForm } from "@/components/body/weight-form";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { PageLoading } from "@/components/ui/page-loading";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { requireUserId } from "@/lib/auth/session";
import { parseDiaryDate } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { formatDayLabel } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { BODY_HREF } from "@/lib/weight/paths";
import { getWeight } from "@/lib/weight/repo";

async function WeightContent({ params }: Pick<PageProps<"/body/[date]">, "params">) {
  const userId = await requireUserId();
  const today = await getUserToday(new Date());
  const date = parseDiaryDate((await params).date, today);
  if (!date) notFound();
  const weightKg = await getWeight(db, userId, date);
  if (weightKg === null) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href={BODY_HREF} />
      <h1 className="text-2xl font-semibold">
        {ru.body.editTitle(formatDayLabel(date, today).toLowerCase())}
      </h1>
      <ResetOnHide>
        <WeightForm
          key={`${date}:${weightKg}`}
          action={saveWeightAction.bind(null, date)}
          label={ru.body.weightLabel}
          initialKg={weightKg}
        />
      </ResetOnHide>
      <ConfirmDeleteButton action={deleteWeightAction.bind(null, date)} />
    </main>
  );
}

export default function WeightPage({ params }: PageProps<"/body/[date]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <WeightContent params={params} />
    </Suspense>
  );
}
