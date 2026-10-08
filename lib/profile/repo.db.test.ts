import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ProfileData } from "@/lib/nutrition";
import { getDefaultTarget, setManualTarget } from "@/lib/targets/repo";
import { createUser } from "@/lib/users/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { getProfile, resetTargetToAuto, saveProfile } from "./repo";

const TODAY = "2026-10-09";
const profile: ProfileData = {
  sex: "male",
  birthDate: "1996-03-15",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
};
const manual = { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 210 };

async function newUserId(email: string): Promise<string> {
  const user = await createUser(testDb, { email, passwordHash: "h" });
  if (!user) throw new Error("user not created");
  return user.id;
}

beforeEach(resetDb);
afterAll(closeTestDb);

describe("saveProfile", () => {
  it("stores the profile and creates an auto default target", async () => {
    const userId = await newUserId("a@mail.com");
    await saveProfile(testDb, userId, profile, TODAY);

    expect(await getProfile(testDb, userId)).toEqual(profile);
    const target = await getDefaultTarget(testDb, userId);
    // numeric(8,2) rounds 82.77 / 359.5175 on write.
    expect(target).toEqual({
      mode: "auto",
      kcal: 2759,
      proteinG: 144,
      fatG: 82.77,
      carbsG: 359.52,
    });
  });

  it("recalculates an auto target when the profile changes", async () => {
    const userId = await newUserId("a@mail.com");
    await saveProfile(testDb, userId, profile, TODAY);
    await saveProfile(testDb, userId, { ...profile, goal: "lose" }, TODAY);

    expect((await getDefaultTarget(testDb, userId))?.kcal).toBeCloseTo(2345.15, 2);
  });

  it("leaves a manual target untouched when the profile changes", async () => {
    const userId = await newUserId("a@mail.com");
    await saveProfile(testDb, userId, profile, TODAY);
    await setManualTarget(testDb, userId, manual);
    await saveProfile(testDb, userId, { ...profile, weightKg: 70 }, TODAY);

    expect(await getDefaultTarget(testDb, userId)).toEqual({ mode: "manual", ...manual });
    expect((await getProfile(testDb, userId))?.weightKg).toBe(70);
  });
});

describe("resetTargetToAuto", () => {
  it("switches a manual target back to calculated values", async () => {
    const userId = await newUserId("a@mail.com");
    await saveProfile(testDb, userId, profile, TODAY);
    await setManualTarget(testDb, userId, manual);

    expect(await resetTargetToAuto(testDb, userId, TODAY)).toBe(true);
    expect(await getDefaultTarget(testDb, userId)).toMatchObject({ mode: "auto", kcal: 2759 });
  });

  it("returns false when the user has no profile yet", async () => {
    const userId = await newUserId("a@mail.com");
    expect(await resetTargetToAuto(testDb, userId, TODAY)).toBe(false);
  });
});

describe("user isolation", () => {
  it("never returns or changes another user's data", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    await saveProfile(testDb, alice, profile, TODAY);

    expect(await getProfile(testDb, bob)).toBeNull();
    expect(await getDefaultTarget(testDb, bob)).toBeNull();

    await setManualTarget(testDb, bob, manual);
    expect((await getDefaultTarget(testDb, alice))?.mode).toBe("auto");
  });
});
