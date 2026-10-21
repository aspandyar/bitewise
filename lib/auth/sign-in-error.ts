import { AUTH } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";

export function signInErrorMessage(error: string | null | undefined): string {
  return error === AUTH.busySignInError ? ru.auth.tooManyAttempts : ru.auth.invalidCredentials;
}
