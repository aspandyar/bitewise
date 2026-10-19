export type HealthResult = { status: 200 | 503; body: { ok: boolean } };

// Public and unauthenticated (the container healthcheck and nginx call it), so it says only
// "ok" or not: no error text, hosts or versions.
export async function handleHealth(
  ping: () => Promise<void>,
  timeoutMs: number,
): Promise<HealthResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health check timed out")), timeoutMs);
  });
  try {
    await Promise.race([ping(), timeout]);
    return { status: 200, body: { ok: true } };
  } catch {
    return { status: 503, body: { ok: false } };
  } finally {
    clearTimeout(timer);
  }
}
