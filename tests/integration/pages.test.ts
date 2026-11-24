import { describe, it, expect, beforeAll } from "vitest";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

describe("Page Integration & Static Build Verification", () => {
  const distDir = resolve(process.cwd(), "dist");

  const expectedPages = [
    { path: "index.html", titleSubstring: "Hidden Lewd Studio" },
    { path: "commissions/index.html", titleSubstring: "Commissions" },
    { path: "requests/index.html", titleSubstring: "Requests" },
    { path: "gallery/index.html", titleSubstring: "Gallery" },
    { path: "faq/index.html", titleSubstring: "FAQ" },
    { path: "terms/index.html", titleSubstring: "Terms" },
    { path: "privacy/index.html", titleSubstring: "Privacy" },
    { path: "commission-policy/index.html", titleSubstring: "Policy" },
    { path: "contact/index.html", titleSubstring: "Contact" },
    { path: "owner/index.html", titleSubstring: "Owner" },
  ];

  beforeAll(async () => {
    // Ensure build output exists or build if necessary
    try {
      await access(resolve(distDir, "index.html"));
    } catch {
      execSync("npm run build", { stdio: "ignore" });
    }
  });

  for (const page of expectedPages) {
    it(`renders ${page.path} with valid document structure and title`, async () => {
      const filePath = resolve(distDir, page.path);
      const html = await readFile(filePath, "utf8");

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</head>");
      expect(html).toContain("</body>");

      // Verify title branding
      expect(html.toLowerCase()).toContain(page.titleSubstring.toLowerCase());

      // Verify viewport and meta tags
      expect(html).toContain('name="viewport"');

      // Verify navigation and footer legal links exist on every layout
      expect(html).toContain("nav");
      expect(html).toContain('href="/requests/"');
      expect(html).toContain('href="/commissions/"');
      expect(html).toContain('href="/terms/"');
      expect(html).toContain('href="/privacy/"');
      expect(html).toContain('href="/commission-policy/"');
      expect(html).toContain('href="/contact/"');
    });
  }
});
