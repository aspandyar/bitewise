// Creates or syncs the single admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
// Run on every deploy, before the app starts accepting sign-ups: pnpm admin:bootstrap
import { connectDb } from "@/db/connect";
import { readDbEnv } from "@/lib/env-read";
import { bootstrapAdmin, BootstrapError } from "@/lib/auth/bootstrap-admin";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { loggableError } from "@/lib/log";
import { createAdmin, findUserByEmail, updatePasswordHash } from "@/lib/users/repo";

// Scripts run outside Next, where "server-only" throws (#32).
const { db, sql } = connectDb(readDbEnv().DATABASE_URL);

const messages = {
  created: "Admin account created.",
  unchanged: "Admin account is up to date.",
  password_updated: "Admin password updated from ADMIN_PASSWORD.",
} as const;

async function main() {
  try {
    const result = await bootstrapAdmin(
      { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
      {
        findUser: (email) => findUserByEmail(db, email),
        createAdmin: (email, passwordHash) => createAdmin(db, email, passwordHash),
        updatePasswordHash: (id, passwordHash) => updatePasswordHash(db, id, passwordHash),
        hashPassword,
        verifyPassword,
      },
    );
    console.log(messages[result]);
  } catch (error) {
    // The message never contains the password: zod reports which field failed, not its value.
    // A failed insert carries the admin's email and password hash in its query parameters (#76).
    console.error(error instanceof BootstrapError ? error.message : loggableError(error));
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
