export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { scrubConsole } = await import("@/lib/log");
  scrubConsole(console);
  // A typo in REGISTRATION stops the server at start, not on the first visit to /register (#27).
  const { isRegistrationOpen } = await import("@/lib/env-read");
  isRegistrationOpen();
}
