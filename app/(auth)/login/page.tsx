import { LoginForm } from "@/components/auth/login-form";
import { ru } from "@/lib/i18n/ru";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{ru.auth.loginTitle}</h1>
      <LoginForm />
    </main>
  );
}
