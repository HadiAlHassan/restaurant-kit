import { useCallback, useSyncExternalStore } from "react";

function canMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatchMedia()) return () => {};
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(subscribe, () => (canMatchMedia() ? window.matchMedia(query).matches : false));
}
