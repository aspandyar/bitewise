import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { isRegistrationOpen } from "@/lib/env";
import { ru } from "@/lib/i18n/ru";

// Read at request time: the image is built once, and the server's env decides (#27).
async function RegisterContent() {
  await connection();
  if (!isRegistrationOpen()) {
    return (
      <>
        <p>{ru.auth.registrationClosed}</p>
        <Link href="/login" className="flex min-h-11 items-center underline text-accent-text">
          {ru.auth.toLogin}
        </Link>
      </>
    );
  }
  return <RegisterForm />;
}

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{ru.auth.registerTitle}</h1>
      <Suspense fallback={null}>
        <RegisterContent />
      </Suspense>
    </main>
  );
}
