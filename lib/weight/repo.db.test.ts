import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ProfileData } from "@/lib/nutrition";
import { getProfile, saveProfile } from "@/lib/profile/repo";
import { getDefaultTarget, setManualTarget } from "@/lib/targets/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { newUserId } from "@/tests/foods";
import { deleteWeight, getWeight, listWeights, saveWeight } from "./repo";

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

  it("falls back to the previous weigh-in when the newest is deleted", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: "2026-10-20", weightKg: 79 }, TODAY);
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 77 }, TODAY);
    await deleteWeight(testDb, alice, TODAY, TODAY);
    expect(await getWeight(testDb, alice, TODAY)).toBeNull();
    expect((await getProfile(testDb, alice))?.weightKg).toBe(79);
  });

  it("keeps the profile weight when the last weigh-in is deleted", async () => {
    const alice = await userWithProfile();
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 77 }, TODAY);
    await deleteWeight(testDb, alice, TODAY, TODAY);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(77);
  });

  it("leaves a manual target alone", async () => {
    const alice = await userWithProfile();
    const manual = { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 210 };
    await setManualTarget(testDb, alice, manual);
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 70 }, TODAY);
    expect((await getProfile(testDb, alice))?.weightKg).toBe(70);
    expect(await getDefaultTarget(testDb, alice)).toEqual({ mode: "manual", ...manual });
  });

  it("never shows or deletes another user's weigh-ins", async () => {
    const alice = await userWithProfile();
    const bob = await userWithProfile("bob@mail.com");
    await saveWeight(testDb, alice, { date: TODAY, weightKg: 79 }, TODAY);
    expect(await listWeights(testDb, bob, "2026-10-01")).toEqual([]);
    expect(await getWeight(testDb, bob, TODAY)).toBeNull();
    await deleteWeight(testDb, bob, TODAY, TODAY);
    expect(await getWeight(testDb, alice, TODAY)).toBe(79);
  });
});
