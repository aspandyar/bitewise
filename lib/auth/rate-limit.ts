export type RateLimitRule = { max: number; windowMs: number; maxKeys: number };
export type RateLimiter = {
  hit(key: string, nowMs: number): boolean;
  // Gives back one hit of the current window: for attempts that failed through no fault of the client.
  refund(key: string, nowMs: number): void;
  size(): number;
};

// In-process fixed window: the app runs as a single container, so shared storage is not needed yet.
export function createRateLimiter(rule: RateLimitRule): RateLimiter {
  const windows = new Map<string, { startMs: number; count: number }>();

  // Entries sit in window-start order (see hit), so expired ones are always at the front and
  // pruning stops at the first live entry instead of scanning the whole map on every request.
  function pruneExpired(nowMs: number) {
    for (const [key, window] of windows) {
      if (nowMs - window.startMs < rule.windowMs) break;
      windows.delete(key);
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
        // Delete first: Map.set on an existing key keeps its old position and would break the order.
        windows.delete(key);
        windows.set(key, { startMs: nowMs, count: 1 });
        return true;
      }
      if (current.count >= rule.max) return false;
      current.count += 1;
      return true;
    },
    refund(key, nowMs) {
      const current = windows.get(key);
      // nowMs is the time of the refunded hit: a window that started after it holds other hits.
      if (!current || current.startMs > nowMs || nowMs - current.startMs >= rule.windowMs) return;
      if (current.count > 0) current.count -= 1;
    },
    size: () => windows.size,
  };
}
