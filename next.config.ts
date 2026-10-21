import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // A self-contained server.js with only the files it needs: the production image copies just this.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
  // The favicon is app/icon.tsx at /icon; browsers and crawlers still ask for /favicon.ico (#98).
  // Temporary, so a real favicon.ico added later is not shadowed by a redirect cached forever.
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/icon", permanent: false }];
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
