import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

function header(name: string): string | undefined {
  return securityHeaders().find((item) => item.key === name)?.value;
}

describe("securityHeaders", () => {
  it("sends a content security policy that only trusts this site", () => {
    const csp = header("Content-Security-Policy") ?? "";
    for (const directive of [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it("lets the barcode scanner compile its WebAssembly and nothing more", () => {
    const scriptSrc = (header("Content-Security-Policy") ?? "")
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
  });

  it("allows the camera for this site only and nothing else", () => {
    expect(header("Permissions-Policy")).toBe("camera=(self), microphone=(), geolocation=()");
  });

  it("keeps the basic hardening headers", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("leaves HSTS to nginx, so a dev server on localhost is never pinned to https", () => {
    expect(header("Strict-Transport-Security")).toBeUndefined();
  });
});
