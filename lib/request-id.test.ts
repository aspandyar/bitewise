import { expect, it } from "vitest";
import { REQUEST_ID } from "@/lib/config";
import { readRequestId, stampRequestId } from "./request-id";

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
