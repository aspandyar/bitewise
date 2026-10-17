import { PWA } from "@/lib/config";

export type InstallHint = "prompt" | "ios" | null;

// iPadOS asks for the desktop site and reports itself as a Mac; touch points give it away.
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function installHint(env: {
  standalone: boolean;
  canPrompt: boolean;
  userAgent: string;
  maxTouchPoints: number;
}): InstallHint {
  if (env.standalone) return null;
  if (env.canPrompt) return "prompt";
  return isIos(env.userAgent, env.maxTouchPoints) ? "ios" : null;
}

// Inline in <head>: Chrome may fire beforeinstallprompt before React hydrates, and a listener added
// in an effect would miss it for good on that visit.
export function installPromptScript(): string {
  const key = JSON.stringify(PWA.installPromptGlobal);
  return `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window[${key}]=e})`;
}
