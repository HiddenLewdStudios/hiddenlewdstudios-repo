import { createClient } from "@supabase/supabase-js";

export function normalizeSupabaseUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9-]+\.supabase\.co/i.test(trimmed) || /^[a-z0-9.-]+(:\d+)?/i.test(trimmed)) {
    return trimmed.startsWith("localhost") || trimmed.startsWith("127.0.0.1")
      ? `http://${trimmed}`
      : `https://${trimmed}`;
  }
  return trimmed;
}

export function isValidHttpUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const rawSupabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const rawSupabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabasePublishableKey = rawSupabasePublishableKey?.trim().replace(/^["']|["']$/g, "");

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey && isValidHttpUrl(supabaseUrl),
);

export const sessionOnlyPreferenceKey = "hls-session-only";

export const browserAuthStorage =
  typeof window === "undefined"
    ? undefined
    : {
        getItem(key: string) {
          const sessionOnly = window.localStorage.getItem(sessionOnlyPreferenceKey) === "true";
          return sessionOnly
            ? window.sessionStorage.getItem(key)
            : (window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key));
        },
        setItem(key: string, value: string) {
          const sessionOnly = window.localStorage.getItem(sessionOnlyPreferenceKey) === "true";
          if (sessionOnly) {
            window.localStorage.removeItem(key);
            window.sessionStorage.setItem(key, value);
          } else {
            window.sessionStorage.removeItem(key);
            window.localStorage.setItem(key, value);
          }
        },
        removeItem(key: string) {
          window.localStorage.removeItem(key);
          window.sessionStorage.removeItem(key);
        },
      };

export function setSessionPersistence(staySignedIn: boolean) {
  if (typeof window === "undefined") return;
  if (staySignedIn) {
    window.localStorage.removeItem(sessionOnlyPreferenceKey);
  } else {
    window.localStorage.setItem(sessionOnlyPreferenceKey, "true");
  }
}

export const supabase =
  isSupabaseConfigured && supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: typeof window !== "undefined",
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: browserAuthStorage,
        },
      })
    : null;
