import "server-only";

// The app's entry to the env readers: a client component importing secrets fails the build
// (#32). Scripts run outside Next and import lib/env-read directly.
export * from "./env-read";
