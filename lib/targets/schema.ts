import { z } from "zod";
import { TARGET_LIMITS } from "@/lib/config";
import { decimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";

const { kcal, macroG } = TARGET_LIMITS;
const grams = () => decimalField(macroG, ru.errors.gramsRange(macroG.min, macroG.max));

export const targetsSchema = z.object({
  kcal: decimalField(kcal, ru.errors.kcalRange(kcal.min, kcal.max)),
  proteinG: grams(),
  fatG: grams(),
  carbsG: grams(),
});
