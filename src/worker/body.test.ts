import { describe, expect, it } from "vitest";
import { readBodyWithLimit } from "./body";

function streamedRequest(bytes: number) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  return new Request("https://example.test/", { method: "POST", body, duplex: "half" } as RequestInit);
}

describe("readBodyWithLimit", () => {
  it("returns the body when it fits", async () => {
    const body = await readBodyWithLimit(new Request("https://example.test/", { method: "POST", body: "hello" }), 10);
    expect(new TextDecoder().decode(body)).toBe("hello");
  });

  it("rejects on a declared Content-Length over the limit", async () => {
    const request = new Request("https://example.test/", { method: "POST", body: "x", headers: { "content-length": "999" } });
    await expect(readBodyWithLimit(request, 10)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects a streamed body without Content-Length once it passes the limit", async () => {
    await expect(readBodyWithLimit(streamedRequest(11), 10)).rejects.toMatchObject({ status: 413 });
  });
});
