"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type HTMLInputTypeAttribute,
  type ReactNode,
} from "react";
import { visibleFieldErrors, type FormState } from "@/lib/forms";

// React 19 resets a form after a `form action` runs, wiping input on validation errors;
// submitting through onSubmit + startTransition keeps what the user typed.
// Spread `formProps` onto the <form>: it also hides an error once its field is edited and moves
// focus to the first invalid field after a failed submit.
export function usePreservingFormAction(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement | null>(null);
  const [edited, setEdited] = useState<ReadonlySet<string>>(() => new Set());

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;
    setEdited(new Set());
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  function markEdited(names: readonly string[]) {
    const fresh = names.filter((name) => name && !edited.has(name));
    if (fresh.length > 0) setEdited((current) => new Set([...current, ...fresh]));
  }

  function onInput(event: FormEvent<HTMLFormElement>) {
    const { target } = event;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      markEdited([target.name]);
    }
  }

  // Buttons that change a value without typing (a stepper, a mode toggle) fire no input event;
  // they name the fields they change in data-edits instead.
  function onClick(event: MouseEvent<HTMLFormElement>) {
    if (!(event.target instanceof Element)) return;
    const names = event.target.closest("[data-edits]")?.getAttribute("data-edits");
    if (names) markEdited(names.split(" "));
  }

  // Runs after the error render, when aria-invalid is already on the fields. A radio group is
  // marked as a whole, so focus goes to its first option.
  useEffect(() => {
    if (!state.fieldErrors) return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target = invalid?.matches("input, textarea, select")
      ? invalid
      : invalid?.querySelector<HTMLElement>("input");
    target?.focus();
  }, [state]);

  return {
    state,
    pending,
    fieldErrors: visibleFieldErrors(state.fieldErrors, edited),
    formProps: { onSubmit, onInput, onClick },
  };
}

type TextFieldProps = {
  label: string;
  name: string;
  type?: HTMLInputTypeAttribute;
  inputMode?: "text" | "decimal" | "numeric" | "email";
  autoComplete?: string;
  defaultValue?: string | number;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
  // A prefilled value gets replaced by typing rather than appended to.
  selectOnFocus?: boolean;
};

export function TextField({
  label,
  name,
  type = "text",
  inputMode,
  autoComplete,
  defaultValue,
  placeholder,
  error,
  autoFocus,
  selectOnFocus,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={selectOnFocus ? (event) => event.currentTarget.select() : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 rounded-lg border border-foreground/40 bg-background px-3 text-base aria-[invalid=true]:border-red-500"
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Four short options (meals) do not fit one row at 375 px, so they get a 2 × 2 grid.
const choiceLayouts = {
  row: "grid auto-cols-fr grid-flow-col gap-2",
  column: "flex flex-col gap-2",
  grid: "grid grid-cols-2 gap-2",
} as const;

type ChoiceOption<T extends string> = { value: T; label: string; hint?: string };

export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  defaultValue,
  error,
  layout = "column",
}: {
  legend: string;
  name: string;
  options: readonly ChoiceOption<T>[];
  defaultValue?: T;
  error?: string;
  layout?: keyof typeof choiceLayouts;
}) {
  const errorId = `${useId()}-error`;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {/* The group carries the error: aria-invalid is not allowed on a single radio. */}
      <div
        role="radiogroup"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={choiceLayouts[layout]}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border border-foreground/40 px-3 py-2 has-[:checked]:border-foreground has-[:checked]:bg-foreground/10 has-[:checked]:font-medium has-[:checked]:ring-2 has-[:checked]:ring-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-500"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="sr-only"
            />
            <span className="text-base">{option.label}</span>
            {option.hint ? <span className="text-sm text-foreground/60">{option.hint}</span> : null}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-lg bg-foreground px-4 font-medium text-background disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  ) : null;
}
