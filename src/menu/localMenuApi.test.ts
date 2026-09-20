// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadShouldUseLocal() {
  vi.resetModules();
  return (await import("./localMenuApi")).shouldUseLocalMenuApi;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shouldUseLocalMenuApi", () => {
  it("is true on localhost with no API base configured", async () => {
    vi.stubEnv("VITE_MENU_API_BASE_URL", "");
    const shouldUseLocalMenuApi = await loadShouldUseLocal();

    expect(window.location.hostname).toBe("localhost");
    expect(shouldUseLocalMenuApi()).toBe(true);
  });

  it("is false on localhost once VITE_MENU_API_BASE_URL points at a Worker", async () => {
    vi.stubEnv("VITE_MENU_API_BASE_URL", "http://localhost:8787");
    const shouldUseLocalMenuApi = await loadShouldUseLocal();

    expect(shouldUseLocalMenuApi()).toBe(false);
  });
});
