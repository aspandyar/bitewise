import { z } from "zod";
import { AUTH } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";

const { min, max } = AUTH.passwordLength;

export const credentialsSchema = z.object({
  email: z
    .string({ error: ru.errors.email })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: ru.errors.email })),
  password: z
    .string({ error: ru.errors.passwordLength(min, max) })
    .min(min, { error: ru.errors.passwordLength(min, max) })
    .max(max, { error: ru.errors.passwordLength(min, max) }),
});
