"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { rememberDeviceAction } from "@/app/(auth)/login/actions";
import { registerAction } from "@/app/(auth)/register/actions";
import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import type { RegisterResult } from "@/lib/auth/register";
import { ru } from "@/lib/i18n/ru";
import { stampRequestId } from "@/lib/request-id";

export function RegisterForm() {
  const router = useRouter();
  const [result, setResult] = useState<RegisterResult>();
  const [pending, setPending] = useState(false);
  const failure = result && !result.ok ? result : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A replayed sign-up (#107) finds the account it made and goes on to sign in.
    const formData = stampRequestId(new FormData(event.currentTarget));
    setPending(true);
    try {
      const registered = await registerAction(formData);
      setResult(registered);
      if (!registered.ok) return;
      const signedIn = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
      if (signedIn?.ok) await rememberDeviceAction().catch(() => undefined);
      router.push(signedIn?.ok ? "/onboarding" : "/login");
      router.refresh();
    } catch {
      // A thrown action or fetch (server down, offline) must still leave visible feedback.
      setResult({ ok: false, formError: ru.common.networkError });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        label={ru.auth.email}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        error={failure?.fieldErrors?.email}
      />
      <TextField
        label={ru.auth.password}
        name="password"
        type="password"
        autoComplete="new-password"
        error={failure?.fieldErrors?.password}
      />
      <FormError message={failure?.formError} />
      <SubmitButton pending={pending}>{ru.auth.registerSubmit}</SubmitButton>
      <Link href="/login" className="flex min-h-11 items-center justify-center text-sm underline text-accent-text">
        {ru.auth.toLogin}
      </Link>
    </form>
  );
}
