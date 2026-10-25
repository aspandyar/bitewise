import { z } from "zod";
import { PROFILE_LIMITS } from "@/lib/config";
import { decimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";

const { weightKg } = PROFILE_LIMITS;

// The same range as the profile: a weigh-in is copied into it and must pass its checks.
export const weightFormSchema = z.object({
  weightKg: decimalField(
    weightKg,
    ru.errors.weightRange(weightKg.min, weightKg.max),
    ru.errors.enter.weight,
  ),
});
