export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { scrubConsole } = await import("@/lib/log");
  scrubConsole(console);
}
