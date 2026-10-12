"use client";

import { useId, useState } from "react";
import { TextField } from "@/components/ui/form";
import { DIARY_LIMITS } from "@/lib/config";
import { formatAmount, formatGrams, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { calcPortionGrams } from "@/lib/nutrition";

// kcal is computed by the server page: the client never derives nutrients itself.
export type PortionOption = { id: string | null; label: string; grams: number; kcal: number };

type AmountMode = "grams" | "portion";

export type AmountInitial = {
  mode: AmountMode;
  portionIndex: number;
  count: number;
  grams: number | null;
};

const { min, max, step } = DIARY_LIMITS.portionCount;

// People type "1,5" on Russian keyboards; the server re-validates whatever is sent.
function parseCount(value: string): number | null {
  const trimmed = value.trim();
  const parsed = Number(trimmed.replace(",", "."));
  return trimmed !== "" && Number.isFinite(parsed) ? parsed : null;
}

const segment =
  "min-h-11 flex-1 rounded-lg border border-foreground/40 px-3 aria-pressed:border-foreground aria-pressed:bg-foreground/10 aria-pressed:font-medium";
const stepper =
  "flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-foreground/40 text-xl disabled:opacity-30";

export function AmountFields({
  portions,
  initial,
  errors,
}: {
  portions: PortionOption[];
  initial: AmountInitial;
  errors: Record<string, string>;
}) {
  const countId = useId();
  const [mode, setMode] = useState<AmountMode>(portions.length > 0 ? initial.mode : "grams");
  const [portionIndex, setPortionIndex] = useState(initial.portionIndex);
  const [count, setCount] = useState(formatAmount(initial.count));
  const [gramsDefault, setGramsDefault] = useState(
    initial.grams === null ? "" : formatAmount(initial.grams),
  );
  const current = parseCount(count);

  // Switching from portions carries the amount over, so saving grams keeps what was picked.
  function selectMode(next: AmountMode) {
    const portion = portions[portionIndex];
    if (next === "grams" && mode === "portion" && portion && current !== null && current > 0) {
      setGramsDefault(formatAmount(calcPortionGrams(portion.grams, current)));
    }
    setMode(next);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">{ru.diary.amountLegend}</legend>
      <input type="hidden" name="mode" value={mode} />
      {portions.length > 0 ? (
        <div className="flex gap-2">
          {(["portion", "grams"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => selectMode(option)}
              className={segment}
            >
              {option === "portion" ? ru.diary.modePortions : ru.diary.modeGrams}
            </button>
          ))}
        </div>
      ) : null}
      {mode === "grams" ? (
        <TextField
          label={ru.diary.grams}
          name="grams"
          inputMode="decimal"
          autoFocus
          selectOnFocus
          defaultValue={gramsDefault}
          error={errors.grams}
        />
      ) : (
        <>
          <div role="radiogroup" aria-label={ru.diary.portion} className="flex flex-col gap-2">
            {portions.map((portion, index) => {
              const text = ru.diary.portionOption(
                portion.label,
                formatGrams(portion.grams),
                formatKcal(portion.kcal),
              );
              // Editing has only the snapshotted portion, which has no id to submit.
              return portion.id === null ? (
                <p key={index} className="flex min-h-11 items-center">
                  {text}
                </p>
              ) : (
                <label
                  key={portion.id}
                  className="flex min-h-11 cursor-pointer items-center rounded-lg border border-foreground/40 px-3 py-2 has-[:checked]:border-foreground has-[:checked]:bg-foreground/10 has-[:checked]:font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500"
                >
                  <input
                    type="radio"
                    name="portionId"
                    value={portion.id}
                    checked={index === portionIndex}
                    onChange={() => setPortionIndex(index)}
                    className="sr-only"
                  />
                  <span className="[overflow-wrap:anywhere]">{text}</span>
                </label>
              );
            })}
          </div>
          {errors.portionId ? (
            <p className="text-sm text-red-600 dark:text-red-400">{errors.portionId}</p>
          ) : null}
          <div className="flex flex-col gap-1">
            <label htmlFor={countId} className="text-sm font-medium">
              {ru.diary.count}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={ru.diary.decrease}
                disabled={current === null || current - step < min}
                onClick={() => current !== null && setCount(formatAmount(current - step))}
                className={stepper}
              >
                {ru.diary.minus}
              </button>
              <input
                id={countId}
                name="count"
                inputMode="decimal"
                value={count}
                onChange={(event) => setCount(event.target.value)}
                aria-invalid={errors.count ? true : undefined}
                aria-describedby={errors.count ? `${countId}-error` : undefined}
                className="min-h-11 w-24 rounded-lg border border-foreground/40 bg-background px-3 text-center text-base aria-[invalid=true]:border-red-500"
              />
              <button
                type="button"
                aria-label={ru.diary.increase}
                disabled={current === null || current + step > max}
                onClick={() => current !== null && setCount(formatAmount(current + step))}
                className={stepper}
              >
                {ru.diary.plus}
              </button>
            </div>
            {errors.count ? (
              <p id={`${countId}-error`} className="text-sm text-red-600 dark:text-red-400">
                {errors.count}
              </p>
            ) : null}
          </div>
        </>
      )}
    </fieldset>
  );
}
