import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kept from the create-next-app 16.4 template: it is the framework's current default model,
  // and turning it off later is easier than migrating to it once screens exist.
  cacheComponents: true,
  partialPrefetching: true,
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
