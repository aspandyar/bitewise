export class BusyError extends Error {
  constructor() {
    super("too many concurrent tasks");
  }
}

// Caps CPU- and memory-heavy work (scrypt takes ~32 MB per hash) so a burst of sign-ins cannot
// starve a small server; past the queue limit callers fail fast instead of piling up.
export function createSemaphore({
  maxConcurrent,
  maxQueued,
}: {
  maxConcurrent: number;
  maxQueued: number;
}) {
  let active = 0;
  const waiting: (() => void)[] = [];

  function release() {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }

  async function acquire(): Promise<void> {
    if (active < maxConcurrent) {
      active += 1;
      return;
    }
    if (waiting.length >= maxQueued) throw new BusyError();
    // The slot passes straight to the waiter, so `active` stays the same.
    await new Promise<void>((resolve) => waiting.push(resolve));
  }

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}
