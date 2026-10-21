"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import { signInErrorMessage } from "@/lib/auth/sign-in-error";
import { ru } from "@/lib/i18n/ru";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
      if (!result?.ok) {
        setError(signInErrorMessage(result?.error));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      // A thrown action or fetch (server down, offline) must still leave visible feedback.
      setError(ru.common.networkError);
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
      />
      <TextField
        label={ru.auth.password}
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <FormError message={error} />
      <SubmitButton pending={pending}>{ru.auth.loginSubmit}</SubmitButton>
      <Link
        href="/register"
        className="flex min-h-11 items-center justify-center text-sm underline text-accent-text"
      >
        {ru.auth.toRegister}
      </Link>
    </form>
  );
}
