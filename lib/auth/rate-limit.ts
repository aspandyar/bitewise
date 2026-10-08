export type RateLimitRule = { max: number; windowMs: number; maxKeys: number };
export type RateLimiter = { hit(key: string, nowMs: number): boolean; size(): number };

// In-process fixed window: the app runs as a single container, so shared storage is not needed yet.
export function createRateLimiter(rule: RateLimitRule): RateLimiter {
  const windows = new Map<string, { startMs: number; count: number }>();

  function pruneExpired(nowMs: number) {
    for (const [key, window] of windows) {
      if (nowMs - window.startMs >= rule.windowMs) windows.delete(key);
    }
  }

  return {
    hit(key, nowMs) {
      const current = windows.get(key);
      if (!current || nowMs - current.startMs >= rule.windowMs) {
        if (!current && windows.size >= rule.maxKeys) {
          pruneExpired(nowMs);
          // Fail closed when still full: evicting a live counter would let a flood of junk keys
          // reset someone's attempt budget, which matters more than serving new keys during a flood.
          if (windows.size >= rule.maxKeys) return false;
        }
        windows.set(key, { startMs: nowMs, count: 1 });
        return true;
      }
      if (current.count >= rule.max) return false;
      current.count += 1;
      return true;
    },
    size: () => windows.size,
  };
}
