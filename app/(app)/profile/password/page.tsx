import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";

async function PasswordContent() {
  await requireUserId();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href="/profile" />
      <h1 className="text-2xl font-semibold">{ru.auth.changePasswordTitle}</h1>
      {/* Passwords typed here must not come back when the screen is opened again. */}
      <ResetOnHide>
        <ChangePasswordForm />
      </ResetOnHide>
    </main>
  );
}

export default function PasswordPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PasswordContent />
    </Suspense>
  );
}
