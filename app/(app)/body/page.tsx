import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { saveWeightAction } from "@/app/(app)/body/actions";
import { WeightChart } from "@/components/body/weight-chart";
import { WeightForm } from "@/components/body/weight-form";
import { WeightHistory } from "@/components/body/weight-history";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { requireUserId } from "@/lib/auth/session";
import { calcWeightTrend } from "@/lib/body";
import { WEIGHT } from "@/lib/config";
import { addDays } from "@/lib/date";
import { getUserToday } from "@/lib/diary/today";
import { formatWeightKg } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { getProfile } from "@/lib/profile/repo";
import { listWeights } from "@/lib/weight/repo";

async function BodyContent() {
  const userId = await requireUserId();
  const today = await getUserToday(new Date());
  const from = addDays(today, 1 - WEIGHT.chartDays);
  const [profile, entries] = await Promise.all([
    getProfile(db, userId),
    listWeights(db, userId, from),
  ]);
  if (!profile) redirect("/onboarding");
  const trend = calcWeightTrend(entries);
  const latest = trend.at(-1);
  // A short history fills the chart instead of hugging its right edge; ISO dates compare as text.
  const firstDate = trend[0]?.date;
  const chartFrom = firstDate && firstDate > from ? firstDate : from;
  // Today's weigh-in, else the last one: one tap saves the same weight, typing replaces it.
  const initialKg = entries[0]?.weightKg ?? profile.weightKg;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink />
      <h1 className="text-2xl font-semibold">{ru.body.title}</h1>
      <div className="flex flex-col gap-2">
        {/* cacheComponents keeps this screen alive; a save must not leave the old value typed. */}
        <ResetOnHide>
          <WeightForm
            key={`${today}:${initialKg}`}
            action={saveWeightAction.bind(null, today)}
            label={ru.body.todayLabel}
            initialKg={initialKg}
          />
        </ResetOnHide>
        <p className="text-sm text-foreground/60">{ru.body.profileHint}</p>
      </div>
      {latest ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">{ru.body.chartTitle}</h2>
            <p className="text-sm text-foreground/60">
              {ru.body.average(formatWeightKg(latest.averageKg))}
            </p>
          </div>
          <WeightChart points={trend} from={chartFrom} to={today} />
        </section>
      ) : (
        <p className="text-foreground/60">{ru.body.empty}</p>
      )}
      {entries.length > 0 && <WeightHistory entries={entries} today={today} />}
    </main>
  );
}

// The session and the time zone cookie are read at request time, so they stay behind a boundary.
export default function BodyPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BodyContent />
    </Suspense>
  );
}
