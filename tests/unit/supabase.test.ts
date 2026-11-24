import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeSupabaseUrl,
  isValidHttpUrl,
  setSessionPersistence,
  browserAuthStorage,
  sessionOnlyPreferenceKey,
  isSupabaseConfigured,
} from "../../src/lib/supabase";

describe("src/lib/supabase.ts", () => {
  describe("normalizeSupabaseUrl", () => {
    it("returns undefined for undefined, null, or empty string", () => {
      expect(normalizeSupabaseUrl(undefined)).toBeUndefined();
      expect(normalizeSupabaseUrl("")).toBeUndefined();
      expect(normalizeSupabaseUrl("   ")).toBeUndefined();
    });

    it("strips wrapping double and single quotes", () => {
      expect(normalizeSupabaseUrl('"https://example.supabase.co"')).toBe(
        "https://example.supabase.co",
      );
      expect(normalizeSupabaseUrl("'https://example.supabase.co'")).toBe(
        "https://example.supabase.co",
      );
    });

    it("preserves URLs that already contain http or https protocols", () => {
      expect(normalizeSupabaseUrl("https://project.supabase.co")).toBe(
        "https://project.supabase.co",
      );
      expect(normalizeSupabaseUrl("http://localhost:54321")).toBe("http://localhost:54321");
    });

    it("prepends https to bare supabase.co domains", () => {
      expect(normalizeSupabaseUrl("custom-project.supabase.co")).toBe(
        "https://custom-project.supabase.co",
      );
    });

    it("prepends http to localhost and 127.0.0.1 domains", () => {
      expect(normalizeSupabaseUrl("localhost:54321")).toBe("http://localhost:54321");
      expect(normalizeSupabaseUrl("127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
    });
  });

  describe("isValidHttpUrl", () => {
    it("returns false for undefined, null, or empty strings", () => {
      expect(isValidHttpUrl(undefined)).toBe(false);
      expect(isValidHttpUrl("")).toBe(false);
    });

    it("returns true for valid http and https URLs", () => {
      expect(isValidHttpUrl("https://example.supabase.co")).toBe(true);
      expect(isValidHttpUrl("http://localhost:54321")).toBe(true);
    });

    it("returns false for invalid protocols or invalid URL strings", () => {
      expect(isValidHttpUrl("ftp://files.example.com")).toBe(false);
      expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isValidHttpUrl("not-a-valid-url")).toBe(false);
    });
  });

  describe("browserAuthStorage & setSessionPersistence", () => {
    beforeEach(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    it("toggles session persistence in localStorage", () => {
      setSessionPersistence(false);
      expect(window.localStorage.getItem(sessionOnlyPreferenceKey)).toBe("true");

      setSessionPersistence(true);
      expect(window.localStorage.getItem(sessionOnlyPreferenceKey)).toBeNull();
    });

    it("stores items in localStorage by default when session-only is not active", () => {
      setSessionPersistence(true);
      browserAuthStorage?.setItem("test_key", "test_value");

      expect(window.localStorage.getItem("test_key")).toBe("test_value");
      expect(window.sessionStorage.getItem("test_key")).toBeNull();
      expect(browserAuthStorage?.getItem("test_key")).toBe("test_value");
    });

    it("stores items in sessionStorage when session-only is active", () => {
      setSessionPersistence(false);
      browserAuthStorage?.setItem("test_key", "session_value");

      expect(window.sessionStorage.getItem("test_key")).toBe("session_value");
      expect(window.localStorage.getItem("test_key")).toBeNull();
      expect(browserAuthStorage?.getItem("test_key")).toBe("session_value");
    });

    it("removes items from both local and session storage", () => {
      window.localStorage.setItem("item_to_remove", "123");
      window.sessionStorage.setItem("item_to_remove", "123");

      browserAuthStorage?.removeItem("item_to_remove");

      expect(window.localStorage.getItem("item_to_remove")).toBeNull();
      expect(window.sessionStorage.getItem("item_to_remove")).toBeNull();
    });
  });

  describe("isSupabaseConfigured", () => {
    it("is a boolean flag reflecting environment readiness", () => {
      expect(typeof isSupabaseConfigured).toBe("boolean");
    });
  });
});
