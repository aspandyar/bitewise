export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAllowlist(raw: string): Set<string> {
  return new Set(raw.split(",").map(normalizeEmail).filter(Boolean));
}

export function isEmailAllowed(email: string, allowlist: Set<string>): boolean {
  return allowlist.has(normalizeEmail(email));
}
