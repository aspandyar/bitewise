import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { PageLoading } from "@/components/ui/page-loading";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUserId } from "@/lib/auth/session";
import { formatGrams, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { getDefaultTarget } from "@/lib/targets/repo";

async function HomeContent() {
  const userId = await requireUserId();
  const target = await getDefaultTarget(db, userId);
  if (!target) redirect("/onboarding");

  const macros = [
    { label: ru.targets.protein, grams: target.proteinG },
    { label: ru.targets.fat, grams: target.fatG },
    { label: ru.targets.carbs, grams: target.carbsG },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{ru.app.name}</h1>
      <section className="flex flex-col gap-4 rounded-2xl border border-foreground/10 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{ru.targets.cardTitle}</h2>
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs">
            {ru.targets.modes[target.mode]}
          </span>
        </div>
        <p className="text-4xl font-semibold">
          {formatKcal(target.kcal)}{" "}
          <span className="text-base font-normal">{ru.targets.kcalUnit}</span>
        </p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {macros.map((macro) => (
            <div key={macro.label} className="rounded-lg bg-foreground/5 py-2">
              <dt className="text-xs text-foreground/60">{macro.label}</dt>
              <dd className="font-medium">
                {formatGrams(macro.grams)} {ru.targets.gramsUnit}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <nav className="flex flex-col gap-2">
        <Link
          href="/targets"
          className="flex min-h-11 items-center rounded-lg border border-foreground/20 px-4"
        >
          {ru.targets.editTargets}
        </Link>
        <Link
          href="/profile"
          className="flex min-h-11 items-center rounded-lg border border-foreground/20 px-4"
        >
          {ru.targets.editProfile}
        </Link>
      </nav>
      <SignOutButton />
    </main>
  );
}

// The session is read at request time, so it stays behind a boundary on every navigation.
export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomeContent />
    </Suspense>
  );
}
