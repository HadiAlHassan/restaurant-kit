// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DynamicMenu, Testimonial } from "../menu/menuSchema";
import { MenuDataProvider } from "../menu/useMenuData";
import { demoSeedMenu } from "../testing/fixtures";
import { KitTestWrapper } from "../testing/KitTestWrapper";
import { TestimonialsSection } from "./TestimonialsSection";

const review = (patch: Partial<Testimonial>): Testimonial => ({ id: "r1", author: "Rami K.", rating: 4, text: "Best burger on the highway.", order: 0, isVisible: true, ...patch });

function renderSection(menu: DynamicMenu, config?: Parameters<typeof KitTestWrapper>[0]["config"]) {
  return render(
    <KitTestWrapper config={config}>
      <MenuDataProvider value={{ menu, status: "local" }}>
        <TestimonialsSection />
      </MenuDataProvider>
    </KitTestWrapper>,
  );
}

afterEach(cleanup);

describe("TestimonialsSection", () => {
  it("renders nothing for menus without visible testimonials", () => {
    expect(renderSection(demoSeedMenu).container.innerHTML).toBe("");
    cleanup();
    expect(renderSection({ ...demoSeedMenu, testimonials: [review({ isVisible: false })] }).container.innerHTML).toBe("");
  });

  it("shows the review, stars, photo and source link under the default headline", () => {
    renderSection({ ...demoSeedMenu, testimonials: [review({ image: "assets/reviews/rami.jpg", sourceUrl: "https://maps.app.goo.gl/abc" })] });

    expect(screen.getByRole("heading", { name: "Our customers' cameras don't lie." })).toBeTruthy();
    expect(screen.getByText("Best burger on the highway.")).toBeTruthy();
    expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeTruthy();
    expect(screen.getByAltText("Photo shared by Rami K.").getAttribute("src")).toBe("/assets/reviews/rami.jpg");
    expect(screen.getByRole("link", { name: /Read on Google/ }).getAttribute("href")).toBe("https://maps.app.goo.gl/abc");
  });

  it("takes its copy from the site config when provided", () => {
    renderSection({ ...demoSeedMenu, testimonials: [review({})] }, { testimonialsHeadline: "Don't take our word for it." });

    expect(screen.getByRole("heading", { name: "Don't take our word for it." })).toBeTruthy();
  });

  it("offers carousel arrows only when the cards overflow, and steps one card per click", () => {
    const { container } = renderSection({ ...demoSeedMenu, testimonials: [review({ id: "a" }), review({ id: "b", order: 1 }), review({ id: "c", order: 2 })] });
    expect(screen.queryByRole("button", { name: "Next reviews" })).toBeNull();

    const track = container.querySelector("ul")!;
    Object.defineProperties(track, { clientWidth: { value: 400, configurable: true }, scrollWidth: { value: 1200, configurable: true } });
    track.scrollBy = vi.fn();
    vi.spyOn(track.querySelector("li")!, "getBoundingClientRect").mockReturnValue({ width: 340 } as DOMRect);
    fireEvent.scroll(track);

    expect((screen.getByRole("button", { name: "Previous reviews" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next reviews" }));
    expect(track.scrollBy).toHaveBeenCalledWith({ left: 340, behavior: "smooth" });
  });
});
