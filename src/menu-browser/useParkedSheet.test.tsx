// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useParkedSheet } from "./useParkedSheet";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "");
});

describe("useParkedSheet", () => {
  it("parks a token-tagged entry on open and pops it on close", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result } = renderHook(() => useParkedSheet<string>());

    act(() => result.current.open("sheet"));
    expect(result.current.value).toBe("sheet");
    expect(pushSpy).toHaveBeenCalledWith({ parkedSheet: expect.any(Number) }, "");

    act(() => result.current.close());
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("closes in place when another entry was pushed on top of the parked one", () => {
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const onClosed = vi.fn();
    const { result } = renderHook(() => useParkedSheet<string>(onClosed));

    act(() => result.current.open("sheet"));
    window.history.pushState({ somethingElse: true }, "");

    act(() => result.current.close());

    expect(backSpy).not.toHaveBeenCalled();
    expect(result.current.value).toBeNull();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("does not treat a foreign parkedSheet entry as its own", () => {
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    window.history.pushState({ parkedSheet: 1 }, "");
    const { result, unmount } = renderHook(() => useParkedSheet<string>());

    act(() => result.current.close());
    unmount();

    expect(backSpy).not.toHaveBeenCalled();
  });

  it("pops its own entry when unmounted while open", () => {
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useParkedSheet<string>());

    act(() => result.current.open("sheet"));
    unmount();

    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves history alone when unmounted after the entry was already popped", () => {
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {
      window.history.replaceState(null, "");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const { result, unmount } = renderHook(() => useParkedSheet<string>());

    act(() => result.current.open("sheet"));
    act(() => result.current.close());
    expect(result.current.value).toBeNull();

    unmount();

    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
