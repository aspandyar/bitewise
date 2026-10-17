"use client";

import { useFormStatus } from "react-dom";
import { ru } from "@/lib/i18n/ru";

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
export function FavoriteButton({
  active,
  action,
}: {
  active: boolean;
  action: () => Promise<void>;
}) {
  return (
    <form action={action}>
      <Star active={active} />
    </form>
  );
}
