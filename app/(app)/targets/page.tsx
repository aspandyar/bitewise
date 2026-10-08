import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { TargetsForm } from "@/components/targets/targets-form";
import { requireUserId } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/date";
import { ru } from "@/lib/i18n/ru";
import { calcAutoTargets } from "@/lib/nutrition";
import { getProfile } from "@/lib/profile/repo";
import { getDefaultTarget } from "@/lib/targets/repo";

async function TargetsContent() {
  const userId = await requireUserId();
  const [profile, target] = await Promise.all([
    getProfile(db, userId),
    getDefaultTarget(db, userId),
  ]);
  if (!profile || !target) redirect("/onboarding");
  const calculated = calcAutoTargets(profile, todayIsoDate(new Date()));
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink />
      <h1 className="text-2xl font-semibold">{ru.targets.editTitle}</h1>
      <TargetsForm current={target} calculated={calculated} mode={target.mode} />
    </main>
  );
}

// The session is read at request time, so it stays behind a boundary on every navigation.
export default function TargetsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TargetsContent />
    </Suspense>
  );
}
