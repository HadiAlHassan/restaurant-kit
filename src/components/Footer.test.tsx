// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteConfigContext } from "../config/siteConfigContext";
import type { FooterConfig } from "../config/siteTypes";
import { demoSeedMenu, demoSiteConfig } from "../testing/fixtures";
import { Footer } from "./Footer";

function renderFooter(footer?: FooterConfig) {
  render(
    <SiteConfigContext.Provider value={{ config: { ...demoSiteConfig, footer }, seedMenu: demoSeedMenu }}>
      <Footer />
    </SiteConfigContext.Provider>,
  );
}

const year = new Date().getFullYear();

afterEach(cleanup);

describe("Footer", () => {
  it("shows the default legal line when no footer config is given", () => {
    renderFooter();
    expect(screen.getByText(`© ${year} ${demoSiteConfig.brandName}. All rights reserved.`)).toBeTruthy();
    expect(screen.getByText(demoSiteConfig.footerNote)).toBeTruthy();
  });

  it("replaces the legal line and fills in {year}", () => {
    renderFooter({ legal: "© {year} Someone else" });
    expect(screen.getByText(`© ${year} Someone else`)).toBeTruthy();
    expect(screen.queryByText(/All rights reserved/)).toBeNull();
  });

  it("renders notices with text and links", () => {
    renderFooter({
      notices: [
        ["Built with ", { label: "the kit", href: "https://example.com/kit" }, "."],
        ["Write to ", { label: "me", href: "mailto:me@example.com" }],
      ],
    });

    const external = screen.getByRole("link", { name: "the kit" });
    expect(external.getAttribute("href")).toBe("https://example.com/kit");
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noreferrer");
    expect(external.parentElement?.textContent).toBe("Built with the kit.");

    const mail = screen.getByRole("link", { name: "me" });
    expect(mail.getAttribute("target")).toBeNull();
  });
});
