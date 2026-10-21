"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { QUICK } from "@/lib/config";
import type { FavoriteState } from "@/lib/diary/quick";
import { ru } from "@/lib/i18n/ru";
import { stampRequestId } from "@/lib/request-id";

function Star({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={active}
      aria-label={ru.foods.favorite}
      className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-2xl disabled:opacity-60 ${active ? "text-accent-text" : ""}`}
    >
      {active ? ru.foods.favoriteOn : ru.foods.favoriteOff}
    </button>
  );
}

// A star next to a food or dish name: starred ones sit above recent foods on the add screen.
// The cap message belongs to this visit: a screen kept alive and opened again starts without it,
// since a star removed elsewhere may have made room.
export function FavoriteButton(props: {
  active: boolean;
  action: (prev: FavoriteState, formData: FormData) => Promise<FavoriteState>;
}) {
  return (
    <ResetOnHide>
      <FavoriteForm {...props} />
    </ResetOnHide>
  );
}

function FavoriteForm({
  active,
  action,
}: {
  active: boolean;
  action: (prev: FavoriteState, formData: FormData) => Promise<FavoriteState>;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={(formData) => formAction(stampRequestId(formData))}
      className="flex shrink-0 flex-col items-end"
    >
      <Star active={active} />
      {/* Always mounted, so a screen reader announces the message when it appears. */}
      <p role="status" className="max-w-40 text-right text-xs text-red-600 dark:text-red-400">
        {state === "limit" ? ru.foods.favoriteLimit(QUICK.maxFavorites) : null}
      </p>
    </form>
  );
}
