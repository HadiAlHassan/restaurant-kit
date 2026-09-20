// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteConfigContext } from "../config/siteConfigContext";
import { demoSeedMenu, demoSiteConfig } from "../testing/fixtures";
import { RatingSection } from "./RatingSection";

function renderWithRating(rating: string) {
  cleanup();
  render(
    <SiteConfigContext.Provider value={{ config: { ...demoSiteConfig, rating }, seedMenu: demoSeedMenu }}>
      <RatingSection />
    </SiteConfigContext.Provider>,
  );
  return screen.getByLabelText(demoSiteConfig.ratingLabel).textContent;
}

afterEach(cleanup);

describe("RatingSection stars", () => {
  it("fills stars according to the configured rating", () => {
    expect(renderWithRating("3.2")).toBe("★★★☆☆");
  });

  it("rounds half ratings up", () => {
    expect(renderWithRating("4.5")).toBe("★★★★★");
    expect(renderWithRating("4.4")).toBe("★★★★☆");
  });

  it("clamps out-of-range ratings and falls back to five for unparsable ones", () => {
    expect(renderWithRating("9")).toBe("★★★★★");
    expect(renderWithRating("-2")).toBe("☆☆☆☆☆");
    expect(renderWithRating("great")).toBe("★★★★★");
  });
});
