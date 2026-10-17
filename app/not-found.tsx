import Link from "next/link";
import { ru } from "@/lib/i18n/ru";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
      <p>{ru.common.notFound}</p>
      <Link href="/" className="flex min-h-11 items-center underline text-accent-text">
        {ru.common.toHome}
      </Link>
    </main>
  );
}
