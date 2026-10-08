"use client";

import { ru } from "@/lib/i18n/ru";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
      <p>{ru.common.errorTitle}</p>
      <button
        type="button"
        onClick={retry}
        className="min-h-11 rounded-lg border border-foreground/20 px-4"
      >
        {ru.common.retry}
      </button>
    </main>
  );
}
