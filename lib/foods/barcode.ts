import { BARCODE } from "@/lib/config";

const DIGITS = /^[0-9]+$/;
const EAN13_LENGTH = 13;
const UPC_E_LENGTH = 8;

// GS1 check digit: weights 3 and 1 alternate from the rightmost data digit, so leading zeros
// never change it and one rule covers every GTIN length.
function hasValidCheckDigit(code: string): boolean {
  let sum = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
    sum += Number(code[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}

// One pack scanned as UPC-A, typed as EAN-13 or listed as GTIN-14 must land on one row, so
// those three forms of a zero-led code are stored as EAN-13.
export function normalizeBarcode(raw: string): string | null {
  const code = raw.trim();
  if (!DIGITS.test(code)) return null;
  if (!(BARCODE.lengths as readonly number[]).includes(code.length)) return null;
  if (!hasValidCheckDigit(code)) return null;
  if (code.length < EAN13_LENGTH && code.length !== UPC_E_LENGTH)
    return code.padStart(EAN13_LENGTH, "0");
  if (code.length > EAN13_LENGTH && code.startsWith("0")) return code.slice(1);
  return code;
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
