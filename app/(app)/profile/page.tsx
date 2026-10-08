import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";
import { getProfile } from "@/lib/profile/repo";

async function ProfileContent() {
  const userId = await requireUserId();
  const profile = await getProfile(db, userId);
  if (!profile) redirect("/onboarding");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink />
      <h1 className="text-2xl font-semibold">{ru.profile.editTitle}</h1>
      <ProfileForm defaults={profile} submitLabel={ru.common.save} />
    </main>
  );
}

// The session is read at request time, so it stays behind a boundary on every navigation.
export default function ProfilePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProfileContent />
    </Suspense>
  );
}
