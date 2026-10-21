import { expect, it } from "vitest";
import { AUTH } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { signInErrorMessage } from "./sign-in-error";

it("tells an overloaded sign-in apart from wrong credentials", () => {
  expect(signInErrorMessage(AUTH.busySignInError)).toBe(ru.auth.tooManyAttempts);
});

it("shows the generic message for every other failure", () => {
  expect(signInErrorMessage("CredentialsSignin")).toBe(ru.auth.invalidCredentials);
  expect(signInErrorMessage(null)).toBe(ru.auth.invalidCredentials);
  expect(signInErrorMessage(undefined)).toBe(ru.auth.invalidCredentials);
});
