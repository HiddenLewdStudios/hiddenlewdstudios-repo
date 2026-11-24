import { describe, it, expect } from "vitest";
import { characters, tagPool } from "../../src/data/characters";

describe("src/data/characters.ts", () => {
  describe("characters catalog", () => {
    it("contains non-empty list of initial characters", () => {
      expect(Array.isArray(characters)).toBe(true);
      expect(characters.length).toBeGreaterThan(0);
    });

    it("ensures each character has a valid name and franchise", () => {
      for (const char of characters) {
        expect(typeof char.name).toBe("string");
        expect(char.name.trim().length).toBeGreaterThan(0);
        expect(typeof char.franchise).toBe("string");
        expect(char.franchise.trim().length).toBeGreaterThan(0);
      }
    });

    it("ensures each character has at least one valid version with a label", () => {
      for (const char of characters) {
        expect(Array.isArray(char.versions)).toBe(true);
        expect(char.versions.length).toBeGreaterThan(0);

        for (const version of char.versions) {
          expect(typeof version.label).toBe("string");
          expect(version.label.trim().length).toBeGreaterThan(0);
          if (version.image !== undefined) {
            expect(typeof version.image).toBe("string");
          }
        }
      }
    });

    it("has unique names across character entries", () => {
      const names = characters.map((c) => c.name.toLowerCase());
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe("tagPool", () => {
    it("has all required prompt category pools", () => {
      expect(tagPool).toHaveProperty("actions");
      expect(tagPool).toHaveProperty("contexts");
      expect(tagPool).toHaveProperty("relations");
      expect(tagPool).toHaveProperty("plots");
    });

    it("ensures every pool contains non-empty strings", () => {
      const categories = ["actions", "contexts", "relations", "plots"] as const;
      for (const cat of categories) {
        const items = tagPool[cat];
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          expect(typeof item).toBe("string");
          expect(item.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });
});
