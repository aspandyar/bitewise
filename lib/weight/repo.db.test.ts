import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { weightSaveRequests } from "@/db/schema";
import { WEIGHT } from "@/lib/config";
import type { ProfileData } from "@/lib/nutrition";
import { getProfile, saveProfile } from "@/lib/profile/repo";
import { getDefaultTarget, setManualTarget } from "@/lib/targets/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { newUserId } from "@/tests/foods";
import { deleteWeight, getWeight, listWeights, saveWeight, updateWeight } from "./repo";

const TODAY = "2026-10-25";
const profile: ProfileData = {
  sex: "male",
  birthDate: "1996-03-15",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
};

beforeEach(resetDb);
afterAll(closeTestDb);

async function idOf(userId: string, date: string): Promise<string> {
  const row = await getWeight(testDb, userId, date);
  if (!row) throw new Error(`no weigh-in on ${date}`);
  return row.id;
}

async function userWithProfile(email = "alice@mail.com"): Promise<string> {
  const userId = await newUserId(email);
  await saveProfile(testDb, userId, profile, TODAY);
  return userId;
}

describe("weight entries", () => {
  it("keeps one weigh-in per day: saving the day again replaces it", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 79.4 }, TODAY);
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 79.1 }, TODAY);
    expect(await listWeights(testDb, alice, "2026-10-01")).toEqual([
      { date: TODAY, weightKg: 79.1 },
    ]);
  });

  it("ignores a replay of an older save, so it cannot bring the old value back (#132)", async () => {
    const alice = await userWithProfile();
    const first = { date: TODAY, weightKg: 79.4, requestId: crypto.randomUUID() };
    await saveWeight(testDb, alice, first, TODAY);
    await saveWeight(
      testDb,
      alice,
      { date: TODAY, weightKg: 79.1, requestId: crypto.randomUUID() },
      TODAY,
    );
    // The browser re-sends the first request after its response was lost.
    await saveWeight(testDb, alice, first, TODAY);
    expect(await listWeights(testDb, alice, "2026-10-01")).toEqual([
      { date: TODAY, weightKg: 79.1 },
    ]);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(79.1);
  });

  it("ignores a replay of an older edit by id, so it cannot bring the old value back", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 80 }, TODAY);
    const id = await idOf(alice, TODAY);
    const first = crypto.randomUUID();
    expect(await updateWeight(testDb, alice, id, 79.4, TODAY, first)).toBe(true);
    expect(await updateWeight(testDb, alice, id, 79.1, TODAY, crypto.randomUUID())).toBe(true);
    // A replay reports success: the edit it repeats did go through.
    expect(await updateWeight(testDb, alice, id, 79.4, TODAY, first)).toBe(true);
    expect((await getWeight(testDb, alice, TODAY))?.weightKg).toBe(79.1);
  });

  it("keeps request keys per user: another account's key does not block a save", async () => {
    const alice = await userWithProfile();
    const bob = await userWithProfile("bob@mail.com");
    const requestId = crypto.randomUUID();
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 79, requestId }, TODAY);
    await saveWeight(testDb, bob, { date: TODAY, weightKg: 90, requestId }, TODAY);
    expect(await listWeights(testDb, bob, "2026-10-01")).toEqual([{ date: TODAY, weightKg: 90 }]);
  });

  it("drops request keys older than the replay window", async () => {
    const alice = await userWithProfile();
    const old = crypto.randomUUID();
    await testDb.insert(weightSaveRequests).values({
      userId: alice,
      clientRequestId: old,
      createdAt: sql`now() - make_interval(days => ${WEIGHT.requestKeyDays + 1})`,
    });
    await saveWeight(
      testDb,
      alice,
      { date: TODAY, weightKg: 79, requestId: crypto.randomUUID() },
      TODAY,
    );
    const keys = await testDb
      .select({ id: weightSaveRequests.clientRequestId })
      .from(weightSaveRequests)
      .where(eq(weightSaveRequests.userId, alice));
    expect(keys.map((key) => key.id)).not.toContain(old);
    expect(keys).toHaveLength(1);
  });

  it("lists weigh-ins from a date, newest first", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: "2026-10-01", weightKg: 81 }, TODAY);
    await saveWeight(testDb, alice, { date: "2026-10-20", weightKg: 80 }, TODAY);
    await saveWeight(testDb, alice, { date: "2026-10-24", weightKg: 79 }, TODAY);
    expect(await listWeights(testDb, alice, "2026-10-20")).toEqual([
      { date: "2026-10-24", weightKg: 79 },
      { date: "2026-10-20", weightKg: 80 },
    ]);
  });

  it("copies the newest weigh-in into the profile and recalculates an auto target", async () => {
    const alice = await userWithProfile();
    const before = await getDefaultTarget(testDb, alice);
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 75 }, TODAY);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(75);
    const after = await getDefaultTarget(testDb, alice);
    // Protein is 1.8 g per kg: 80 kg → 144 g, 75 kg → 135 g.
    expect(before?.proteinG).toBe(144);
    expect(after?.proteinG).toBe(135);
    expect(after?.mode).toBe("auto");
  });

  it("does not let an older weigh-in overwrite the profile", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 78 }, TODAY);
    await saveWeight(testDb, alice, { date: "2026-10-10", weightKg: 82 }, TODAY);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(78);
  });

  it("leaves the profile alone when an older weigh-in is fixed or deleted", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: "2026-10-18", weightKg: 79 }, TODAY);
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 78 }, TODAY);
    // A weight typed in the profile after the last weigh-in.
    const profileNow = await getProfile(testDb, alice);
    await saveProfile(testDb, alice, { ...profileNow!, weightKg: 76 }, TODAY);
    await saveWeight(testDb, alice, { date: "2026-10-18", weightKg: 79.5 }, TODAY);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(76);
    expect(await deleteWeight(testDb, alice, await idOf(alice, "2026-10-18"), TODAY)).toBe(true);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(76);
  });

  it("falls back to the previous weigh-in when the newest is deleted", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: "2026-10-20", weightKg: 79 }, TODAY);
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 77 }, TODAY);
    expect(await deleteWeight(testDb, alice, await idOf(alice, TODAY), TODAY)).toBe(true);
    expect(await getWeight(testDb, alice, TODAY)).toBeNull();
    expect((await getProfile(testDb, alice))?.weightKg).toBe(79);
  });

  it("keeps the profile weight when the last weigh-in is deleted", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 77 }, TODAY);
    await deleteWeight(testDb, alice, await idOf(alice, TODAY), TODAY);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(77);
  });

  it("updates a weigh-in by id and does not re-create a deleted one", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 77 }, TODAY);
    const id = await idOf(alice, TODAY);
    expect(await updateWeight(testDb, alice, id, 76.5, TODAY)).toBe(true);
    expect((await getWeight(testDb, alice, TODAY))?.weightKg).toBe(76.5);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(76.5);
    await deleteWeight(testDb, alice, id, TODAY);
    expect(await updateWeight(testDb, alice, id, 76, TODAY)).toBe(false);
    expect(await getWeight(testDb, alice, TODAY)).toBeNull();
  });

  it("never updates another user's weigh-in", async () => {
    const alice = await userWithProfile();
    const bob = await userWithProfile("bob@mail.com");
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 77 }, TODAY);
    expect(await updateWeight(testDb, bob, await idOf(alice, TODAY), 60, TODAY)).toBe(false);
    expect((await getWeight(testDb, alice, TODAY))?.weightKg).toBe(77);
  });

  it("deletes nothing on a replay, even after the day is entered again", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 77 }, TODAY);
    const oldId = await idOf(alice, TODAY);
    await deleteWeight(testDb, alice, oldId, TODAY);
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 77.5 }, TODAY);
    expect(await deleteWeight(testDb, alice, oldId, TODAY)).toBe(false);
    expect((await getWeight(testDb, alice, TODAY))?.weightKg).toBe(77.5);
  });

  it("leaves a manual target alone", async () => {
    const alice = await userWithProfile();
    const manual = { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 210 };
    await setManualTarget(testDb, alice, manual);
    await saveWeight(testDb, alice, { date: "2026-10-20", weightKg: 71 }, TODAY);
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 70 }, TODAY);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(70);
    expect(await getDefaultTarget(testDb, alice)).toEqual({ mode: "manual", ...manual });
    await deleteWeight(testDb, alice, await idOf(alice, TODAY), TODAY);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(71);
    expect(await getDefaultTarget(testDb, alice)).toEqual({ mode: "manual", ...manual });
  });

  it("never shows or deletes another user's weigh-ins", async () => {
    const alice = await userWithProfile();
    const bob = await userWithProfile("bob@mail.com");
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 79 }, TODAY);
    expect(await listWeights(testDb, bob, "2026-10-01")).toEqual([]);
    expect(await getWeight(testDb, bob, TODAY)).toBeNull();
    expect(await deleteWeight(testDb, bob, await idOf(alice, TODAY), TODAY)).toBe(false);
    expect((await getWeight(testDb, alice, TODAY))?.weightKg).toBe(79);
  });
});
