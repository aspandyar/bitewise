import { expect, it } from "vitest";
import { PASSWORD_HASH } from "@/lib/config";
import { BusyError } from "./semaphore";

// A fresh module: the dummy hash is cached per process, and this test needs its first call.
it("does not keep a failed dummy hash: unknown emails must keep paying for a real hash", async () => {
  const { getDummyPasswordHash, hashPassword } = await import("./password");
  const fill = Array.from({ length: PASSWORD_HASH.maxConcurrent + PASSWORD_HASH.maxQueued }, () =>
    hashPassword("load"),
  );
  await expect(getDummyPasswordHash()).rejects.toBeInstanceOf(BusyError);
  await Promise.all(fill);
  await expect(getDummyPasswordHash()).resolves.toMatch(/^scrypt\$/);
}, 30_000);

it("lets a full hashing queue surface as BusyError instead of a wrong-password answer", async () => {
  const { hashPassword, verifyPassword } = await import("./password");
  const stored = await hashPassword("right-pass");
  const fill = Array.from({ length: PASSWORD_HASH.maxConcurrent + PASSWORD_HASH.maxQueued }, () =>
    hashPassword("load"),
  );
  await expect(verifyPassword("right-pass", stored)).rejects.toBeInstanceOf(BusyError);
  await Promise.all(fill);
  expect(await verifyPassword("right-pass", stored)).toBe(true);
}, 30_000);
