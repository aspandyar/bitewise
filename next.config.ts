import type { NextConfig } from "next";

// Forms must not be embeddable (clickjacking) and responses should not reveal the stack.
// A full CSP and HSTS come with nginx in stage 6; these headers are safe for dev too.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Kept from the create-next-app 16.4 template: it is the framework's current default model,
  // and turning it off later is easier than migrating to it once screens exist.
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // A navigation or server action that hits a dropped connection waits and retries once the
    // network is back instead of failing; useOffline drives the banner. Experimental in Next 16.
    useOffline: true,
  },
  // Tailwind v4 under Turbopack needs its own CSS loader instead of PostCSS.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
