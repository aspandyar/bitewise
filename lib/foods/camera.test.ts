import { describe, expect, it, vi } from "vitest";
import { lookupBarcode, openCamera } from "./camera";

const CODE = "4610169567113";
const diary = { kind: "diary" as const, date: "2026-10-22" as const, meal: "breakfast" as const };

function fakeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

describe("openCamera", () => {
  it("returns the stream when the scanner is still open", async () => {
    const { stream, track } = fakeStream();
    expect(
      await openCamera(
        async () => stream,
        () => false,
      ),
    ).toBe(stream);
    expect(track.stop).not.toHaveBeenCalled();
  });

  it("stops a stream that arrives after the scanner was closed", async () => {
    const { stream, track } = fakeStream();
    let stopped = false;
    const pending = openCamera(
      async () => {
        stopped = true; // closed while the permission prompt was up
        return stream;
      },
      () => stopped,
    );
    expect(await pending).toBeNull();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("asks for the back camera without sound", async () => {
    const getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>(
      async () => fakeStream().stream,
    );
    await openCamera(getUserMedia, () => false);
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  });
});

describe("lookupBarcode", () => {
  const json = (body: unknown, status = 200) =>
    vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it("navigates to where the answer leads", async () => {
    const result = await lookupBarcode(CODE, diary, {
      fetch: json({ status: "found", foodId: "f1" }),
      signal: new AbortController().signal,
    });
    expect(result).toEqual({
      kind: "navigate",
      href: "/diary/add/f1?date=2026-10-22&meal=breakfast",
    });
  });

  it("does nothing once the scanner was closed, even if the answer arrives", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort();
      return new Response(JSON.stringify({ status: "found", foodId: "f1" }));
    });
    expect(
      await lookupBarcode(CODE, diary, { fetch: fetchMock, signal: controller.signal }),
    ).toEqual({
      kind: "aborted",
    });
  });

  it("reports unavailable, throttling, a lost session and other failures apart", async () => {
    const signal = new AbortController().signal;
    expect(
      await lookupBarcode(CODE, diary, {
        fetch: json({ status: "unavailable", code: CODE }),
        signal,
      }),
    ).toEqual({
      kind: "unavailable",
      code: CODE,
    });
    expect(
      await lookupBarcode(CODE, diary, { fetch: json({ error: "rate_limited" }, 429), signal }),
    ).toEqual({
      kind: "failed",
      reason: "rate_limited",
    });
    expect(
      await lookupBarcode(CODE, diary, { fetch: json({ error: "unauthorized" }, 401), signal }),
    ).toEqual({
      kind: "failed",
      reason: "unauthorized",
    });
    expect(
      await lookupBarcode(CODE, diary, {
        fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline")),
        signal,
      }),
    ).toEqual({ kind: "failed", reason: "other" });
  });

  it("calls fetch unbound, as a browser requires of window.fetch", async () => {
    // A browser throws "Illegal invocation" when fetch runs with any `this` but window.
    function browserFetch(this: unknown): Promise<Response> {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(new Response(JSON.stringify({ status: "found", foodId: "f1" })));
    }
    expect(
      await lookupBarcode(CODE, diary, {
        fetch: browserFetch as typeof fetch,
        signal: new AbortController().signal,
      }),
    ).toEqual({ kind: "navigate", href: "/diary/add/f1?date=2026-10-22&meal=breakfast" });
  });

  it("sends the code in the query", async () => {
    const fetchMock = json({ status: "found", foodId: "f1" });
    await lookupBarcode(CODE, diary, { fetch: fetchMock, signal: new AbortController().signal });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`/api/foods/barcode?code=${CODE}`);
  });
});
