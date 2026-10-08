import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { PageLoading } from "@/components/ui/page-loading";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";
import { getProfile } from "@/lib/profile/repo";

async function OnboardingContent() {
  const userId = await requireUserId();
  if (await getProfile(db, userId)) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">{ru.profile.onboardingTitle}</h1>
      <p className="text-foreground/70">{ru.profile.onboardingHint}</p>
      <ProfileForm submitLabel={ru.profile.submitOnboarding} />
    </main>
  );
}

// The session is read at request time, so it stays behind a boundary on every navigation.
export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <OnboardingContent />
    </Suspense>
  );
}
