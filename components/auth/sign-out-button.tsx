"use client";

import { signOut } from "next-auth/react";
import { ru } from "@/lib/i18n/ru";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="min-h-11 rounded-lg border border-foreground/20 px-4"
    >
      {ru.auth.signOut}
    </button>
  );
}
