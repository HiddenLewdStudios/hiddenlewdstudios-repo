import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const sessionOnlyPreferenceKey = "hls-session-only";

const browserAuthStorage =
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

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: browserAuthStorage,
      },
    })
  : null;
