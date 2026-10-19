import { describe, expect, it } from "vitest";
import { BusyError, createSemaphore } from "./semaphore";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createSemaphore", () => {
  it("runs at most maxConcurrent tasks at once and starts the next in order", async () => {
    const gate = createSemaphore({ maxConcurrent: 2, maxQueued: 10 });
    const started: number[] = [];
    const blockers = [deferred(), deferred(), deferred()];
    const runs = blockers.map((blocker, index) =>
      gate.run(async () => {
        started.push(index);
        await blocker.promise;
        return index;
      }),
    );
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    blockers[0]!.resolve();
    await runs[0];
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    blockers[1]!.resolve();
    blockers[2]!.resolve();
    expect(await Promise.all(runs)).toEqual([0, 1, 2]);
  });

  it("rejects with BusyError once the queue is full", async () => {
    const gate = createSemaphore({ maxConcurrent: 1, maxQueued: 1 });
    const block = deferred();
    const first = gate.run(() => block.promise);
    const second = gate.run(async () => "queued");
    await expect(gate.run(async () => "third")).rejects.toBeInstanceOf(BusyError);
    block.resolve();
    await first;
    expect(await second).toBe("queued");
  });

  it("frees the slot when a task throws", async () => {
    const gate = createSemaphore({ maxConcurrent: 1, maxQueued: 0 });
    await expect(
      gate.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await gate.run(async () => "next")).toBe("next");
  });
});
