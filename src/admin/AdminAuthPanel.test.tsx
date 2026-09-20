// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminAuthPanel } from "./AdminAuthPanel";

function renderPanel(overrides: Partial<Parameters<typeof AdminAuthPanel>[0]> = {}) {
  const props = {
    strategy: "password" as const,
    isLoadingDraft: false,
    isSigningIn: false,
    message: "Unauthorized.",
    onRetry: vi.fn(),
    onSignInWithAccess: vi.fn(),
    onSignInWithPassword: vi.fn(),
    ...overrides,
  };
  render(<AdminAuthPanel {...props} />);
  return props;
}

afterEach(cleanup);

function isDisabled(element: HTMLElement) {
  return (element as HTMLButtonElement | HTMLInputElement).disabled;
}

describe("AdminAuthPanel", () => {
  it("submits the password under the password strategy", () => {
    const props = renderPanel();

    const input = screen.getByLabelText("Password");
    const submit = screen.getByRole("button", { name: "Sign in" });
    expect(isDisabled(submit)).toBe(true);

    fireEvent.change(input, { target: { value: "open sesame" } });
    expect(isDisabled(submit)).toBe(false);
    fireEvent.click(submit);

    expect(props.onSignInWithPassword).toHaveBeenCalledWith("open sesame");
    expect(screen.queryByRole("button", { name: "Sign in with Cloudflare" })).toBeNull();
  });

  it("shows the Access redirect under the access strategy", () => {
    const props = renderPanel({ strategy: "access" });

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Cloudflare" }));
    fireEvent.click(screen.getByRole("button", { name: "I signed in, retry" }));

    expect(props.onSignInWithAccess).toHaveBeenCalledTimes(1);
    expect(props.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("explains a missing configuration instead of offering a sign-in", () => {
    renderPanel({ strategy: "none" });

    expect(screen.getByText("Admin sign-in is not configured")).toBeTruthy();
    expect(screen.getByText(/ADMIN_PASSWORD_HASH/)).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("falls back to a retry when the strategy is unknown", () => {
    const props = renderPanel({ strategy: null, message: "Could not reach the menu API." });

    expect(screen.getByText("Could not reach the menu API")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the form while signing in", () => {
    renderPanel({ isSigningIn: true });

    expect(isDisabled(screen.getByLabelText("Password"))).toBe(true);
    expect(isDisabled(screen.getByRole("button", { name: "Signing in" }))).toBe(true);
  });
});
