import { z } from "zod";
import { AUTH } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";

const { min, max } = AUTH.passwordLength;

// Shared by sign-up, login and server scripts so an email is normalized the same way everywhere.
export const emailSchema = z
  .string({ error: ru.errors.email })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: ru.errors.email }));

export const passwordSchema = z
  .string({ error: ru.errors.passwordLength(min, max) })
  .min(min, { error: ru.errors.passwordLength(min, max) })
  .max(max, { error: ru.errors.passwordLength(min, max) });

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
