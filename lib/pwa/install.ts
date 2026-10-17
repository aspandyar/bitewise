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
