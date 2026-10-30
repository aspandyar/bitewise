import { describe, expect, it } from "vitest";
import { checkBarcode, expandUpcE, normalizeBarcode, upcEAlternative } from "./barcode";

describe("normalizeBarcode", () => {
  it("keeps a valid EAN-13 as it is, trimmed", () => {
    expect(normalizeBarcode("4607001771456")).toBe("4607001771456");
    expect(normalizeBarcode("  4607001771456\n")).toBe("4607001771456");
  });

  it("stores a UPC-A and a zero-led GTIN-14 as the same EAN-13", () => {
    expect(normalizeBarcode("036000291452")).toBe("0036000291452");
    expect(normalizeBarcode("00036000291452")).toBe("0036000291452");
  });

  it("keeps an EAN-8 and a GTIN-14 with a packaging indicator as they are", () => {
    expect(normalizeBarcode("96385074")).toBe("96385074");
    expect(normalizeBarcode("10036000291459")).toBe("10036000291459");
  });

  it("stores an EAN-8 written with leading zeros as the EAN-8 itself", () => {
    expect(normalizeBarcode("000096385074")).toBe("96385074");
    expect(normalizeBarcode("0000096385074")).toBe("96385074");
    expect(normalizeBarcode("00000096385074")).toBe("96385074");
  });

  it("accepts a pasted code with spaces, hyphens or invisible characters", () => {
    expect(normalizeBarcode("4 607001 771456")).toBe("4607001771456");
    expect(normalizeBarcode("4607001-771456")).toBe("4607001771456");
    expect(normalizeBarcode("​4607001771456﻿")).toBe("4607001771456");
    expect(normalizeBarcode("4607001 771456")).toBe("4607001771456");
  });

  it("rejects a wrong check digit, letters, odd lengths and an empty string", () => {
    expect(normalizeBarcode("4607001771457")).toBeNull();
    expect(normalizeBarcode("460700177145a")).toBeNull();
    expect(normalizeBarcode("1234567")).toBeNull();
    expect(normalizeBarcode("123456789")).toBeNull();
    expect(normalizeBarcode("12345678901")).toBeNull();
    expect(normalizeBarcode("123456789012345")).toBeNull();
    expect(normalizeBarcode("")).toBeNull();
    expect(normalizeBarcode(" - ")).toBeNull();
  });
});

describe("checkBarcode", () => {
  it("says whether the digits are wrong in shape or only in the check digit", () => {
    expect(checkBarcode("4607001771456")).toEqual({ code: "4607001771456" });
    expect(checkBarcode("4607001771457")).toEqual({ problem: "check_digit" });
    expect(checkBarcode("460700177145a")).toEqual({ problem: "format" });
    expect(checkBarcode("123456789")).toEqual({ problem: "format" });
  });
});

describe("upcEAlternative", () => {
  it("reads typed 8 digits as a UPC-E too, in its stored EAN-13 form", () => {
    // Valid both ways: as EAN-8 and as UPC-E of 012345000065.
    expect(upcEAlternative("01234565")).toBe("0012345000065");
  });

  it("gives nothing for codes that cannot be a UPC-E", () => {
    expect(upcEAlternative("96385074")).toBeNull();
    expect(upcEAlternative("4607001771456")).toBeNull();
  });
});

describe("expandUpcE", () => {
  it("expands a UPC-E into its UPC-A", () => {
    expect(expandUpcE("01234565")).toBe("012345000065");
  });

  it("expands every UPC-E pattern by its last digit", () => {
    expect(expandUpcE("04252614")).toBe("042100005264"); // 0–2: manufacturer d1 d2 d6
    expect(expandUpcE("01234531")).toBe("012300000451"); // 3
    expect(expandUpcE("01234543")).toBe("012340000053"); // 4
  });

  it("rejects a UPC-E with a wrong check digit or shape", () => {
    expect(expandUpcE("01234566")).toBeNull();
    expect(expandUpcE("21234569")).toBeNull();
    expect(expandUpcE("0123456")).toBeNull();
  });
});
