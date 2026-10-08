import { z } from "zod";
import type { UserRole } from "@/lib/config";
import { emailSchema, passwordSchema } from "./schema";

export class BootstrapError extends Error {}

export type BootstrapDeps = {
  findUser(email: string): Promise<{ id: string; role: UserRole; passwordHash: string } | null>;
  createAdmin(email: string, passwordHash: string): Promise<void>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, stored: string): Promise<boolean>;
};

export type BootstrapResult = "created" | "unchanged" | "password_updated";

const inputSchema = z.object({ email: emailSchema, password: passwordSchema });

// Runs on every deploy: ADMIN_EMAIL / ADMIN_PASSWORD in env are the source of truth for the single
// admin account, and this is the only code path that can create a user with the "admin" role.
export async function bootstrapAdmin(raw: unknown, deps: BootstrapDeps): Promise<BootstrapResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BootstrapError(`invalid ADMIN_EMAIL or ADMIN_PASSWORD: ${parsed.error.message}`);
  }
  const { email, password } = parsed.data;

  const existing = await deps.findUser(email);
  if (!existing) {
    await deps.createAdmin(email, await deps.hashPassword(password));
    return "created";
  }
  // Public sign-up is open, so someone may have registered this email first; promoting that
  // account would hand admin rights to whoever got there before the deploy.
  if (existing.role !== "admin") {
    throw new BootstrapError(
      `${email} already belongs to a non-admin account; refusing to promote it`,
    );
  }
  if (await deps.verifyPassword(password, existing.passwordHash)) return "unchanged";
  await deps.updatePasswordHash(existing.id, await deps.hashPassword(password));
  return "password_updated";
}
