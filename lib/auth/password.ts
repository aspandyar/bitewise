import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { PASSWORD_HASH } from "@/lib/config";
import { createSemaphore } from "./semaphore";

type ScryptParams = { N: number; r: number; p: number; keyLength: number };

const PREFIX = "scrypt";
const PARTS = 6;

// One gate per server process: login, registration and the dummy hash all share it.
const scryptGate = createSemaphore(PASSWORD_HASH);

function deriveKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return scryptGate.run(() => scryptKey(password, salt, params));
}

function scryptKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      params.keyLength,
      { N: params.N, r: params.r, p: params.p, maxmem: PASSWORD_HASH.maxmemBytes },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

// Parameters are stored with each hash so config can be strengthened without breaking old users.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_HASH.saltBytes);
  const key = await deriveKey(password, salt, PASSWORD_HASH);
  const { N, r, p } = PASSWORD_HASH;
  return [PREFIX, N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

function parseStoredHash(stored: string): (ScryptParams & { salt: Buffer; hash: Buffer }) | null {
  const parts = stored.split("$");
  if (parts.length !== PARTS || parts[0] !== PREFIX) return null;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const hash = Buffer.from(parts[5] ?? "", "base64");
  if (salt.length === 0 || hash.length === 0) return null;
  return { N, r, p, keyLength: hash.length, salt, hash };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  try {
    const key = await deriveKey(password, parsed.salt, parsed);
    return timingSafeEqual(key, parsed.hash);
  } catch {
    // Invalid scrypt parameters in a corrupted row, or a full hashing queue, mean "no match", not
    // a 500: login answers with its usual generic failure.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

// Login compares against this when the email is unknown, so response time does not reveal
// which emails are registered.
export function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(PASSWORD_HASH.saltBytes).toString("hex"));
  return dummyHash;
}
