// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoSeedMenu } from "../testing/fixtures";
import { KitTestWrapper } from "../testing/KitTestWrapper";
import { MenuDataProvider, useMenuData, type MenuDataValue } from "./useMenuData";

const readMenuDraft = vi.fn();

vi.mock("./menuDraftStorage", () => ({ readMenuDraft: () => readMenuDraft(), menuDraftStorageKey: (id: string) => `${id}:menu-draft:v1` }));

const localDraft = { ...demoSeedMenu, updatedAt: "2026-09-20T00:00:00Z" };
const providedValue: MenuDataValue = { menu: { ...demoSeedMenu, updatedAt: "2026-01-01T00:00:00Z" }, status: "remote" };

beforeEach(() => {
  readMenuDraft.mockReset().mockReturnValue(localDraft);
});

afterEach(cleanup);

describe("useMenuData", () => {
  it("reads the local draft when nothing provides menu data (local mode)", () => {
    const { result } = renderHook(() => useMenuData(), { wrapper: KitTestWrapper });

    expect(readMenuDraft).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("draft");
    expect(result.current.menu).toBe(localDraft);
  });

  it("skips the local branch entirely when a MenuDataProvider supplies data", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KitTestWrapper>
        <MenuDataProvider value={providedValue}>{children}</MenuDataProvider>
      </KitTestWrapper>
    );
    const { result } = renderHook(() => useMenuData(), { wrapper });

    expect(readMenuDraft).not.toHaveBeenCalled();
    expect(result.current).toBe(providedValue);
  });

  it("fetches the configured public menu URL when an API base is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(localDraft), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = ({ children }: { children: ReactNode }) => <KitTestWrapper api={{ baseUrl: "http://localhost:8787" }}>{children}</KitTestWrapper>;

    const { result } = renderHook(() => useMenuData(), { wrapper });
    await vi.waitFor(() => expect(result.current.status).toBe("remote"));

    expect(readMenuDraft).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8787/api/menu", { cache: "no-store" });
    vi.unstubAllGlobals();
  });
});
