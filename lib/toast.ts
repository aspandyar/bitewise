import { z } from "zod";
import { TOAST_PARAM } from "@/lib/config";

// Server actions end in a redirect, so the confirmation rides along in the URL; only known keys
// are shown, never text from the URL itself.
export const TOASTS = ["saved", "deleted", "copied"] as const;
export type Toast = (typeof TOASTS)[number];

const toastSchema = z.enum(TOASTS);

export function withToast(href: string, toast: Toast): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${TOAST_PARAM}=${toast}`;
}

export function parseToast(value: string | null): Toast | null {
  const parsed = toastSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// The toast leaves the URL as soon as it is picked up: a reload or Back must not show it again.
export function withoutToast(pathname: string, params: URLSearchParams): string {
  const rest = new URLSearchParams(params);
  rest.delete(TOAST_PARAM);
  const query = rest.toString();
  return query ? `${pathname}?${query}` : pathname;
}
