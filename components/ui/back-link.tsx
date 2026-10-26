import Link from "next/link";
import { ru } from "@/lib/i18n/ru";

// Installed as a PWA the app has no browser back button, so every sub-screen needs its own way out.
export function BackLink({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 flex min-h-11 w-fit items-center px-1 text-sm underline text-accent-text"
    >
      {ru.common.back}
    </Link>
  );
}
