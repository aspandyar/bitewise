import { ru } from "@/lib/i18n/ru";

export function PageLoading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-8">
      <p className="text-foreground/60">{ru.common.loading}</p>
    </main>
  );
}
