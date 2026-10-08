"use client";

import { saveProfileAction } from "@/app/(app)/actions";
import {
  ChoiceGroup,
  FormError,
  SubmitButton,
  TextField,
  usePreservingFormAction,
} from "@/components/ui/form";
import { ACTIVITY_LEVELS, GOALS, SEXES } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import type { ProfileData } from "@/lib/nutrition";

const sexOptions = SEXES.map((value) => ({ value, label: ru.profile.sexes[value] }));
const activityOptions = ACTIVITY_LEVELS.map((value) => ({
  value,
  label: ru.profile.activityLevels[value].label,
  hint: ru.profile.activityLevels[value].hint,
}));
const goalOptions = GOALS.map((value) => ({ value, label: ru.profile.goals[value] }));

export function ProfileForm({
  defaults,
  submitLabel,
}: {
  defaults?: ProfileData;
  submitLabel: string;
}) {
  const { state, pending, onSubmit } = usePreservingFormAction(saveProfileAction);
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <ChoiceGroup
        legend={ru.profile.sex}
        name="sex"
        options={sexOptions}
        layout="row"
        defaultValue={defaults?.sex}
        error={errors.sex}
      />
      <TextField
        label={ru.profile.birthDate}
        name="birthDate"
        type="date"
        defaultValue={defaults?.birthDate}
        error={errors.birthDate}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={ru.profile.heightCm}
          name="heightCm"
          inputMode="decimal"
          defaultValue={defaults?.heightCm}
          error={errors.heightCm}
        />
        <TextField
          label={ru.profile.weightKg}
          name="weightKg"
          inputMode="decimal"
          defaultValue={defaults?.weightKg}
          error={errors.weightKg}
        />
      </div>
      <ChoiceGroup
        legend={ru.profile.activityLevel}
        name="activityLevel"
        options={activityOptions}
        defaultValue={defaults?.activityLevel}
        error={errors.activityLevel}
      />
      <ChoiceGroup
        legend={ru.profile.goal}
        name="goal"
        options={goalOptions}
        layout="row"
        defaultValue={defaults?.goal}
        error={errors.goal}
      />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
