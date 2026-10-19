import { SECURITY_HEADERS } from "./config";

// Relative import above: next.config.ts loads this file, where the "@/" alias does not resolve.
// HSTS is nginx's job: sent from here it would pin a dev server on localhost to https.
export function securityHeaders(): { key: string; value: string }[] {
  const csp = Object.entries(SECURITY_HEADERS.csp)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
  const permissions = Object.entries(SECURITY_HEADERS.permissions)
    .map(([feature, allow]) => `${feature}=${allow}`)
    .join(", ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Permissions-Policy", value: permissions },
    // Older browsers ignore frame-ancestors; this keeps forms out of frames there too.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];
}
