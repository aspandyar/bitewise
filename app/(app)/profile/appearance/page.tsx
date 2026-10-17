import { Suspense } from "react";
import { AppearancePicker } from "@/components/profile/appearance-picker";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { getAppearance } from "@/lib/appearance-server";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";

async function AppearanceContent() {
  await requireUserId();
  const appearance = await getAppearance();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href="/profile" />
      <h1 className="text-2xl font-semibold">{ru.appearance.title}</h1>
      {/* cacheComponents keeps the screen alive; the key drops a stale choice on return. */}
      <AppearancePicker key={`${appearance.theme}:${appearance.accent}`} initial={appearance} />
    </main>
  );
}

// Cookies are read at request time, so the screen waits behind its own boundary.
export default function AppearancePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AppearanceContent />
    </Suspense>
  );
}
