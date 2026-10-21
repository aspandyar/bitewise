import { afterEach, describe, expect, it, vi } from "vitest";
import { REQUEST_ID } from "@/lib/config";
import { isForeignRequest, readRequestId, setRequestUser, stampRequestId } from "./request-id";

function form(value?: string) {
  const data = new FormData();
  if (value !== undefined) data.set(REQUEST_ID.field, value);
  return data;
}

it("reads the client's request key", () => {
  const key = "0b6f3f0e-5a7c-4c1e-9d2a-3f4b5c6d7e8f";
  expect(readRequestId(form(key))).toBe(key);
});

it("treats a missing or malformed key as none, so the request still goes through", () => {
  expect(readRequestId(form())).toBeNull();
  expect(readRequestId(form("not-a-uuid"))).toBeNull();
  expect(readRequestId(form(""))).toBeNull();
  expect(readRequestId(undefined)).toBeNull();
});

it("stamps every submit with a fresh key the server accepts", () => {
  const first = stampRequestId(new FormData());
  const second = stampRequestId(new FormData());
  expect(readRequestId(first)).not.toBeNull();
  expect(readRequestId(first)).not.toBe(readRequestId(second));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("reads nothing from an argument that is not a form", () => {
  expect(readRequestId("0b6f3f0e-5a7c-4c1e-9d2a-3f4b5c6d7e8f" as unknown as FormData)).toBeNull();
  expect(readRequestId(42 as unknown as FormData)).toBeNull();
});

it("sends the form without a key where randomUUID is missing (plain http on a LAN address)", () => {
  vi.stubGlobal("crypto", {});
  const data = stampRequestId(new FormData());
  expect(data.has(REQUEST_ID.field)).toBe(false);
});

describe("the user a request was made for", () => {
  const alice = "0b6f3f0e-5a7c-4c1e-9d2a-3f4b5c6d7e8f";
  const bob = "1c7a4f1f-6b8d-4d2f-8e3b-4a5c6d7e8f90";

  afterEach(() => setRequestUser(null));

  it("stamps the signed-in user next to the key", () => {
    setRequestUser(alice);
    expect(isForeignRequest(stampRequestId(new FormData()), alice)).toBe(false);
  });

  it("flags a replay that arrives under another session", () => {
    setRequestUser(alice);
    expect(isForeignRequest(stampRequestId(new FormData()), bob)).toBe(true);
  });

  it("lets through a form without a user (no JS, page before this release)", () => {
    expect(isForeignRequest(stampRequestId(new FormData()), bob)).toBe(false);
    expect(isForeignRequest(new FormData(), bob)).toBe(false);
    expect(isForeignRequest(undefined, bob)).toBe(false);
  });
});
