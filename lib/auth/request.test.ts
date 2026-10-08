import { describe, expect, it } from "vitest";
import { clientIpFromForwardedFor, forwardedForHeader, UNKNOWN_IP } from "./request";

describe("clientIpFromForwardedFor", () => {
  it("takes the address appended by the trusted proxy, not the client-supplied one", () => {
    // The client sent "1.2.3.4"; nginx appended the real peer address.
    expect(clientIpFromForwardedFor("1.2.3.4, 203.0.113.7", 1)).toBe("203.0.113.7");
  });

  it("counts hops from the right when there are several trusted proxies", () => {
    expect(clientIpFromForwardedFor("1.2.3.4, 203.0.113.7, 10.0.0.1", 2)).toBe("203.0.113.7");
  });

  it("returns UNKNOWN_IP when the chain is shorter than the trusted hops", () => {
    expect(clientIpFromForwardedFor("203.0.113.7", 2)).toBe(UNKNOWN_IP);
  });

  it.each([null, undefined, "", "  "])("returns UNKNOWN_IP for %j", (value) => {
    expect(clientIpFromForwardedFor(value, 1)).toBe(UNKNOWN_IP);
  });
});

describe("forwardedForHeader", () => {
  it("passes a single header value through", () => {
    expect(forwardedForHeader("1.2.3.4, 203.0.113.7")).toBe("1.2.3.4, 203.0.113.7");
  });

  it("joins repeated headers in order, so the proxy-appended entry stays last", () => {
    expect(forwardedForHeader(["1.2.3.4", "203.0.113.7"])).toBe("1.2.3.4, 203.0.113.7");
  });

  it.each([undefined, null, 42, {}])("returns null for %j", (value) => {
    expect(forwardedForHeader(value)).toBeNull();
  });
});
