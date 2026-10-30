import { BARCODE } from "@/lib/config";

const DIGITS = /^[0-9]+$/;
// What a code copied from a site or a note brings along: grouping spaces (also non-breaking),
// hyphens, and zero-width characters that are invisible in the field.
const SEPARATORS = /[\s\-​-‍⁠﻿]/g;
const EAN13_LENGTH = 13;
const GTIN14_LENGTH = 14;
const UPC_E_LENGTH = 8;
const EAN8_LENGTH = 8;
// GS1 writes an EAN-8 in a longer field behind six zeros (five in 13 digits); company prefixes
// starting so are never issued, so such a code is always an EAN-8.
const EAN8_PADDING = "000000";

// GS1 check digit: weights 3 and 1 alternate from the rightmost data digit, so leading zeros
// never change it and one rule covers every GTIN length.
function hasValidCheckDigit(code: string): boolean {
  let sum = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
    sum += Number(code[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}

// "check_digit" apart from "format": the digits have the right shape, so the person most likely
// mistyped one of them, and the message says so instead of listing lengths.
export type BarcodeCheck = { code: string } | { problem: "format" | "check_digit" };

// One pack scanned as UPC-A, typed as EAN-13 or listed as GTIN-14 must land on one row, so
// those three forms of a zero-led code are stored as EAN-13, and an EAN-8 as its 8 digits.
export function checkBarcode(raw: string): BarcodeCheck {
  const code = raw.replace(SEPARATORS, "");
  if (!DIGITS.test(code)) return { problem: "format" };
  if (!(BARCODE.lengths as readonly number[]).includes(code.length)) return { problem: "format" };
  if (!hasValidCheckDigit(code)) return { problem: "check_digit" };
  // Leading zeros do not change the check digit, so every padded form stays valid.
  const gtin14 = code.padStart(GTIN14_LENGTH, "0");
  if (gtin14.startsWith(EAN8_PADDING)) return { code: gtin14.slice(-EAN8_LENGTH) };
  if (code.length < EAN13_LENGTH && code.length !== UPC_E_LENGTH)
    return { code: code.padStart(EAN13_LENGTH, "0") };
  if (code.length > EAN13_LENGTH && code.startsWith("0")) return { code: code.slice(1) };
  return { code };
}

export function normalizeBarcode(raw: string): string | null {
  const result = checkBarcode(raw);
  return "code" in result ? result.code : null;
}

// Typed 8 digits can be an EAN-8 or a UPC-E, and often both pass their check digits; the camera
// knows which it saw, a person does not. The lookup tries this form when the EAN-8 finds nothing.
export function upcEAlternative(code: string): string | null {
  const upcA = expandUpcE(code);
  return upcA ? normalizeBarcode(upcA) : null;
}

// A scanner reporting the upc_e format hands over the short form; the database only knows the
// long one, which shares the check digit.
export function expandUpcE(code: string): string | null {
  if (code.length !== UPC_E_LENGTH || !DIGITS.test(code)) return null;
  const system = code[0];
  if (system !== "0" && system !== "1") return null;
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7);
  const check = code[7];
  let body: string;
  if (d6 === "0" || d6 === "1" || d6 === "2") body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  const upcA = `${system}${body}${check}`;
  return hasValidCheckDigit(upcA) ? upcA : null;
}
