import { z } from "zod";
import { TOAST_PARAM, UNDO_PARAM } from "@/lib/config";

// Server actions end in a redirect, so the confirmation rides along in the URL; only known keys
// are shown, never text from the URL itself.
export const TOASTS = ["saved", "deleted", "copied", "added", "addedMany"] as const;
export type Toast = (typeof TOASTS)[number];

const toastSchema = z.enum(TOASTS);

// Undo ids are uuids, so they need no escaping and stay readable in the URL.
export function withToast(href: string, toast: Toast, undo: readonly string[] = []): string {
  const separator = href.includes("?") ? "&" : "?";
  const undoPart = undo.length > 0 ? `&${UNDO_PARAM}=${undo.join(",")}` : "";
  return `${href}${separator}${TOAST_PARAM}=${toast}${undoPart}`;
}

export function parseToast(value: string | null): Toast | null {
  const parsed = toastSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// The toast leaves the URL as soon as it is picked up: a reload or Back must not show it again.
export function withoutToast(pathname: string, params: URLSearchParams): string {
  const rest = new URLSearchParams(params);
  rest.delete(TOAST_PARAM);
  rest.delete(UNDO_PARAM);
  const query = rest.toString();
  return query ? `${pathname}?${query}` : pathname;
}
