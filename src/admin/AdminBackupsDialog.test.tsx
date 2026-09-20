// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminBackupsDialog } from "./AdminBackupsDialog";

const backups = [
  { key: "restaurants/demo/backups/published-2026-03-01T10-00-00-000Z.json", publishedAt: "2026-03-01T10:00:00.000Z", size: 2048 },
  { key: "restaurants/demo/backups/published-2026-02-01T10-00-00-000Z.json", publishedAt: "2026-02-01T10:00:00.000Z", size: 512 },
];

beforeEach(() => {
  // jsdom has no dialog.showModal
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminBackupsDialog", () => {
  it("lists backups newest first and restores after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onRestore = vi.fn();
    render(<AdminBackupsDialog listBackups={vi.fn().mockResolvedValue(backups)} onClose={vi.fn()} onRestore={onRestore} />);

    const buttons = await screen.findAllByRole("button", { name: "Restore" });
    expect(buttons).toHaveLength(2);
    expect(screen.getByText(/2 KB/)).toBeTruthy();

    fireEvent.click(buttons[0]);
    expect(onRestore).toHaveBeenCalledWith(backups[0].key);
  });

  it("does nothing when the confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onRestore = vi.fn();
    render(<AdminBackupsDialog listBackups={vi.fn().mockResolvedValue(backups)} onClose={vi.fn()} onRestore={onRestore} />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Restore" }))[1]);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("explains an empty history and surfaces load errors", async () => {
    const { unmount } = render(<AdminBackupsDialog listBackups={vi.fn().mockResolvedValue([])} onClose={vi.fn()} onRestore={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/No backups yet/)).toBeTruthy());
    unmount();

    render(<AdminBackupsDialog listBackups={vi.fn().mockRejectedValue(new Error("Backups unavailable."))} onClose={vi.fn()} onRestore={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Backups unavailable.")).toBeTruthy());
  });
});
