// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { shouldUseLocalMenuApi } from "./localMenuApi";

describe("shouldUseLocalMenuApi", () => {
  it("is true on localhost with no API base configured", () => {
    expect(window.location.hostname).toBe("localhost");
    expect(shouldUseLocalMenuApi()).toBe(true);
    expect(shouldUseLocalMenuApi("  ")).toBe(true);
  });

  it("is false on localhost once an API base URL points at a Worker", () => {
    expect(shouldUseLocalMenuApi("http://localhost:8787")).toBe(false);
  });
});
