"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FOOD_SEARCH } from "@/lib/config";
import type { FoodListItem } from "@/lib/foods/types";
import { ru } from "@/lib/i18n/ru";
import type { ScanTarget } from "@/lib/foods/scan";
import { foodCardHref, FoodList } from "./food-list";
import { ScanButton } from "./scan-button";

type SearchState =
  | { kind: "loading"; query: string }
  | { kind: "results"; query: string; items: FoodListItem[] }
  | { kind: "error"; query: string; message: string };

// A plain object rather than a function: server pages pass it, and functions cannot cross to the client.
type FoodLink = { prefix: string; search?: string };

function foodHref(link: FoodLink | undefined, food: FoodListItem): string {
  return link
    ? `${link.prefix}${food.id}${link.search ? `?${link.search}` : ""}`
    : foodCardHref(food);
}

export function FoodSearch({
  ownFoods,
  link,
  excludeRecipes = false,
  idle,
  newFoodSearch,
  initialQuery = "",
  scan,
}: {
  ownFoods: FoodListItem[];
  link?: FoodLink;
  excludeRecipes?: boolean;
  // Shown instead of the own foods list while the query is empty (the diary's quick lists).
  idle?: ReactNode;
  // Carried to "add your own" so a new food can return to the entry it was started for.
  newFoodSearch?: string;
  // From ?q=: the screen reopens on the search a new food was started from (#92).
  initialQuery?: string;
  // Where a scanned code leads; without it there is no scanner (picking a dish's ingredients).
  scan?: ScanTarget;
}) {
  const router = useRouter();
  const [input, setInput] = useState(initialQuery);
  const [state, setState] = useState<SearchState | null>(null);
  // The last successful list stays on screen while the next query loads, so typing does not
  // make the results blink away on every letter.
  const [lastItems, setLastItems] = useState<FoodListItem[]>([]);
  // Bumped by "retry": the same query runs again without retyping it.
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter pressed before this query's results arrive: they open the top one when they land.
  const pendingEnterRef = useRef<string | null>(null);
  const query = input.trim();

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    // Debounced and aborted on every keystroke, so a slow old response never replaces a newer one.
    const timer = setTimeout(async () => {
      setState({ kind: "loading", query });
      try {
        const params = new URLSearchParams({ q: query });
        // Ingredient pickers ask the server to leave dishes out.
        if (excludeRecipes) params.set("exclude", "recipes");
        const response = await fetch(`/api/foods/search?${params}`, { signal: controller.signal });
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
        const first = body.items[0];
        if (pendingEnterRef.current === query && first) {
          pendingEnterRef.current = null;
          router.push(foodHref(link, first));
          return;
        }
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
  }, [query, router, excludeRecipes, attempt, link]);

  const hrefFor = (food: FoodListItem) => foodHref(link, food);

  // A state for an older query is stale until the debounce for the current one fires.
  const current = state?.query === query ? state : null;

  // Enter (or "search" on a phone keyboard) opens the top result: typing "греч" + Enter is enough.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // An IME commits its composition with Enter; that must not open a result.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (current?.kind !== "results") {
      pendingEnterRef.current = query || null;
      return;
    }
    const first = current.items[0];
    if (first) router.push(hrefFor(first));
  }

  // Shows the loading state at once (the rerun still waits out the debounce) and drops the old
  // list, so a stale row cannot be tapped while the new search loads.
  function retry() {
    setState({ kind: "loading", query });
    setLastItems([]);
    setAttempt((count) => count + 1);
    inputRef.current?.focus();
  }

  function clear() {
    setInput("");
    setLastItems([]);
    inputRef.current?.focus();
  }

  const newFoodParams = new URLSearchParams(newFoodSearch);
  newFoodParams.set("name", query);
  const newFoodHref = `/foods/new?${newFoodParams}`;

  return (
    <div className="flex flex-col gap-4">
      {/* The clear button sits outside the label, so it does not become part of the field's name. */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label className="flex flex-col gap-1">
            <span className="sr-only">{ru.foods.searchLabel}</span>
            <input
              ref={inputRef}
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={ru.foods.searchPlaceholder}
              maxLength={FOOD_SEARCH.maxQueryLength}
              autoComplete="off"
              enterKeyHint="search"
              // Search is the only job of this screen; desktop browsers focus it at once (iOS will
              // not raise the keyboard without a tap, which is fine).
              autoFocus
              // The native clear cross is a few pixels wide; our own button below is 44 px.
              className="min-h-11 rounded-lg border border-foreground/40 bg-background py-0 pr-11 pl-3 text-base [&::-webkit-search-cancel-button]:appearance-none"
            />
          </label>
          {input ? (
            <button
              type="button"
              onClick={clear}
              aria-label={ru.foods.clearSearch}
              className="absolute top-0 right-0 flex size-11 items-center justify-center text-xl text-foreground/60"
            >
              {ru.foods.clearSymbol}
            </button>
          ) : null}
        </div>
        {scan ? <ScanButton target={scan} /> : null}
      </div>
      {!query && idle ? (
        idle
      ) : !query ? (
        ownFoods.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-foreground/60">
              {ownFoods.some((food) => food.isRecipe)
                ? ru.foods.ownTitleWithRecipes
                : ru.foods.ownTitle}
            </h2>
            <FoodList items={ownFoods} hrefFor={hrefFor} />
          </section>
        ) : (
          <p className="text-foreground/60">{ru.foods.startTyping}</p>
        )
      ) : !current || current.kind === "loading" ? (
        lastItems.length > 0 ? (
          // inert: the dimmed list belongs to the previous query and must not be tapped.
          <div aria-busy="true" inert className="opacity-60">
            <FoodList items={lastItems} hrefFor={hrefFor} />
          </div>
        ) : (
          <p className="text-foreground/60" aria-live="polite">
            {ru.foods.searching}
          </p>
        )
      ) : current.kind === "error" ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-red-600 dark:text-red-400">
            {current.message}
          </p>
          <button
            type="button"
            onClick={retry}
            className="flex min-h-11 w-fit items-center rounded-lg border border-foreground/40 px-4"
          >
            {ru.common.retry}
          </button>
        </div>
      ) : current.items.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p>{ru.foods.nothingFound}</p>
          <Link
            href={newFoodHref}
            className="flex min-h-11 w-fit items-center underline text-accent-text"
          >
            {ru.foods.addOwnInstead}
          </Link>
        </div>
      ) : (
        <FoodList items={current.items} hrefFor={hrefFor} />
      )}
    </div>
  );
}
