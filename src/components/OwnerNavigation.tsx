import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const baseUrl = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

function isOwner(appMetadata: Record<string, unknown> | undefined) {
  return appMetadata?.role === "owner";
}

export default function OwnerNavigation() {
  const [canAccessOwnerWorkspace, setCanAccessOwnerWorkspace] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function updateOwnerAccess() {
      const {
        data: { user },
      } = await client.auth.getUser();
      setCanAccessOwnerWorkspace(isOwner(user?.app_metadata));
    }

    void updateOwnerAccess();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => void updateOwnerAccess());
    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured || !canAccessOwnerWorkspace) return null;

  return <a href={`${baseUrl}owner/`}>Owner workspace</a>;
}
