"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { changePasswordAction } from "@/app/(app)/actions";
import { rememberDeviceAction } from "@/app/(auth)/login/actions";
import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import type { ChangePasswordResult } from "@/lib/auth/change-password";
import { ru } from "@/lib/i18n/ru";
import { stampRequestId } from "@/lib/request-id";
import { withToast } from "@/lib/toast";

// The change revokes every session, this one too (#29), so the device signs in again with the
// new password right away; if that fails, the login screen is the honest next step.
export function ChangePasswordForm() {
  const router = useRouter();
  const [result, setResult] = useState<ChangePasswordResult>();
  const [pending, setPending] = useState(false);
  const failure = result && !result.ok ? result : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = stampRequestId(new FormData(event.currentTarget));
    setPending(true);
    try {
      const changed = await changePasswordAction(formData);
      setResult(changed);
      if (!changed.ok) return;
      const signedIn = await signIn("credentials", {
        email: changed.email,
        password: String(formData.get("newPassword") ?? ""),
        redirect: false,
      });
      // The new password revoked this device's mark too; it gets a fresh one.
      if (signedIn?.ok) await rememberDeviceAction().catch(() => undefined);
      router.push(signedIn?.ok ? withToast("/profile", "passwordChanged") : "/login");
      router.refresh();
    } catch {
      setResult({ ok: false, formError: ru.common.networkError });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        label={ru.auth.currentPassword}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={failure?.fieldErrors?.currentPassword}
      />
      <TextField
        label={ru.auth.newPassword}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        error={failure?.fieldErrors?.newPassword}
      />
      <FormError message={failure?.formError} />
      <SubmitButton pending={pending}>{ru.auth.changePasswordSubmit}</SubmitButton>
    </form>
  );
}
