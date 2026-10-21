import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { isRegistrationOpen } from "@/lib/env";
import { ru } from "@/lib/i18n/ru";

// Read at request time, like the register page: a closed sign-up shows no dead-end link (#27).
async function RegisterLink() {
  await connection();
  if (!isRegistrationOpen()) return null;
  return (
    <Link
      href="/register"
      className="flex min-h-11 items-center justify-center text-sm underline text-accent-text"
    >
      {ru.auth.toRegister}
    </Link>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{ru.auth.loginTitle}</h1>
      <LoginForm />
      <Suspense fallback={null}>
        <RegisterLink />
      </Suspense>
    </main>
  );
}
