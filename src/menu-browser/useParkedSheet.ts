import { useEffect, useRef, useState } from "react";

function isParkedEntry(token: number) {
  return token !== 0 && window.history.state?.parkedSheet === token;
}

/**
 * State for a sheet/dialog that the browser back button should close.
 * Opening parks a history entry; every close routes through history.back()
 * so popping the entry is the single close path (pushing from the open
 * handler, never an effect, keeps StrictMode's double effects harmless).
 * Each parked entry is tagged with a token so only this hook's own entry is
 * ever popped, and unmounting while open pops it instead of leaving it behind.
 */
export function useParkedSheet<T>(onClosed?: () => void) {
  const [value, setValue] = useState<T | null>(null);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const tokenRef = useRef(0);

  const open = (next: T) => {
    tokenRef.current = Date.now();
    window.history.pushState({ parkedSheet: tokenRef.current }, "");
    setValue(next);
  };

  const close = () => {
    if (isParkedEntry(tokenRef.current)) {
      window.history.back();
      return;
    }
    setValue(null);
    onClosedRef.current?.();
  };

  useEffect(
    () => () => {
      if (isParkedEntry(tokenRef.current)) window.history.back();
    },
    [],
  );

  useEffect(() => {
    if (value === null) return;
    const handlePopState = () => {
      setValue(null);
      onClosedRef.current?.();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [value]);

  return { value, open, close };
}
