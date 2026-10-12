"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FOOD_SEARCH } from "@/lib/config";
import type { FoodListItem } from "@/lib/foods/types";
import { ru } from "@/lib/i18n/ru";
import { FoodList } from "./food-list";

type SearchState =
  | { kind: "loading"; query: string }
  | { kind: "results"; query: string; items: FoodListItem[] }
  | { kind: "error"; query: string; message: string };

// A plain object rather than a function: server pages pass it, and functions cannot cross to the client.
type FoodLink = { prefix: string; search?: string };

export function FoodSearch({ ownFoods, link }: { ownFoods: FoodListItem[]; link?: FoodLink }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [state, setState] = useState<SearchState | null>(null);
  // The last successful list stays on screen while the next query loads, so typing does not
  // make the results blink away on every letter.
  const [lastItems, setLastItems] = useState<FoodListItem[]>([]);
  const query = input.trim();

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    // Debounced and aborted on every keystroke, so a slow old response never replaces a newer one.
    const timer = setTimeout(async () => {
      setState({ kind: "loading", query });
      try {
        const response = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          const message =
            response.status === 429 ? ru.foods.tooManyRequests : ru.foods.searchFailed;
          setState({ kind: "error", query, message });
          return;
        }
        const body = (await response.json()) as { items: FoodListItem[] };
        setState({ kind: "results", query, items: body.items });
        setLastItems(body.items);
      } catch {
        if (controller.signal.aborted) return;
        setState({ kind: "error", query, message: ru.common.networkError });
      }
    }, FOOD_SEARCH.debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, router]);

  const hrefFor = link
    ? (food: FoodListItem) => `${link.prefix}${food.id}${link.search ? `?${link.search}` : ""}`
    : undefined;

  // A state for an older query is stale until the debounce for the current one fires.
  const current = state?.query === query ? state : null;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="sr-only">{ru.foods.searchLabel}</span>
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={ru.foods.searchPlaceholder}
          maxLength={FOOD_SEARCH.maxQueryLength}
          autoComplete="off"
          enterKeyHint="search"
          // Search is the only job of this screen; desktop browsers focus it at once (iOS will
          // not raise the keyboard without a tap, which is fine).
          autoFocus
          className="min-h-11 rounded-lg border border-foreground/40 bg-background px-3 text-base"
        />
      </label>
      {!query ? (
        ownFoods.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-foreground/60">{ru.foods.ownTitle}</h2>
            <FoodList items={ownFoods} hrefFor={hrefFor} />
          </section>
        ) : (
          <p className="text-foreground/60">{ru.foods.startTyping}</p>
        )
      ) : !current || current.kind === "loading" ? (
        lastItems.length > 0 ? (
          <div aria-busy="true" className="opacity-60">
            <FoodList items={lastItems} hrefFor={hrefFor} />
          </div>
        ) : (
          <p className="text-foreground/60" aria-live="polite">
            {ru.foods.searching}
          </p>
        )
      ) : current.kind === "error" ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {current.message}
        </p>
      ) : current.items.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p>{ru.foods.nothingFound}</p>
          <Link href="/foods/new" className="flex min-h-11 w-fit items-center underline">
            {ru.foods.addOwnInstead}
          </Link>
        </div>
      ) : (
        <FoodList items={current.items} hrefFor={hrefFor} />
      )}
    </div>
  );
}
