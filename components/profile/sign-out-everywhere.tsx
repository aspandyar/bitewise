"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState, useTransition } from "react";
import { signOutEverywhereAction } from "@/app/(app)/actions";
import { FormError } from "@/components/ui/form";
import { ru } from "@/lib/i18n/ru";
import { stampRequestId } from "@/lib/request-id";

const outlined = "min-h-11 rounded-lg border border-foreground/40 px-4 disabled:opacity-60";

// Two steps, like delete: one stray tap must not sign out every device (#29).
export function SignOutEverywhere() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // A hidden screen keeps its state; every visit starts unarmed.
  useEffect(() => () => setConfirming(false), []);

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      try {
        await signOutEverywhereAction(stampRequestId(new FormData()));
      } catch {
        // Offline or a server error: nothing was revoked, so this device stays signed in too.
        setError(ru.common.networkError);
        return;
      }
      await signOut({ callbackUrl: "/login" });
    });
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${outlined} w-fit`}>
        {ru.auth.signOutEverywhere}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground/60">{ru.auth.signOutEverywhereHint}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="min-h-11 rounded-lg bg-red-600 px-4 font-medium text-white disabled:opacity-60"
        >
          {ru.auth.signOutEverywhereConfirm}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={outlined}>
          {ru.common.cancel}
        </button>
      </div>
      <FormError message={error} />
    </div>
  );
}
