import { createClient } from "npm:@supabase/supabase-js@2.119.0";

import fetchAcdb from "npm:node-fetch@3.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CharacterResult = { name: string; franchise: string; sourceUrl: string };

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeResults(payload: unknown): CharacterResult[] {
  const items = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { search_results?: unknown[] }).search_results)
      ? (payload as { search_results: unknown[] }).search_results
      : [];
  return items.slice(0, 10).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? record.character_name ?? record.romaji_name ?? "").trim();
    const franchise = String(record.anime_name ?? record.franchise ?? record.title ?? "").trim();
    const id = String(record.id ?? record.character_id ?? "").trim();
    return name
      ? [
          {
            name,
            franchise: franchise || "Anime Characters Database",
            sourceUrl: id
              ? `https://www.animecharactersdatabase.com/characters.php?id=${encodeURIComponent(id)}`
              : "https://www.animecharactersdatabase.com/",
          },
        ]
      : [];
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const body = (await request.json().catch(() => null)) as { q?: unknown } | null;
  const rawQuery = body?.q;
  const query =
    typeof rawQuery === "string" ? rawQuery.trim().replace(/\s+/g, " ").toLowerCase() : "";
  if (query.length < 2 || query.length > 80) {
    return respond({ error: "Use a search query between 2 and 80 characters." }, 400);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const externalSearchEnabled = Deno.env.get("ACDB_EXTERNAL_ENABLED") === "true";
  if (!url || !serviceRoleKey)
    return respond({ error: "Server configuration is incomplete." }, 500);
  if (!externalSearchEnabled) {
    return respond({
      results: [],
      cached: false,
      unavailable: true,
      message: "Live character search is available only in production.",
    });
  }
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const now = new Date();
  const cached = await admin
    .from("character_search_cache")
    .select("results")
    .eq("query", query)
    .gt("expires_at", now.toISOString())
    .maybeSingle<{ results: CharacterResult[] }>();
  if (cached.error) return respond({ error: "Search cache unavailable." }, 503);
  if (cached.data)
    return respond({
      results: cached.data.results,
      cached: true,
      attribution: "Anime Characters Database",
    });

  const claim = await admin.rpc("claim_character_search_cache_miss", { search_query: query });
  if (claim.error) return respond({ error: "Search coordination unavailable." }, 503);
  if (claim.data !== true) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const coalesced = await admin
        .from("character_search_cache")
        .select("results")
        .eq("query", query)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle<{ results: CharacterResult[] }>();
      if (coalesced.error) return respond({ error: "Search cache unavailable." }, 503);
      if (coalesced.data)
        return respond({
          results: coalesced.data.results,
          cached: true,
          attribution: "Anime Characters Database",
        });
    }
    return respond({ error: "Search already in progress. Please try again shortly." }, 429);
  }

  let providerDeferred = false;
  try {
    const slot = await admin.rpc("reserve_acdb_request");
    if (slot.error) return respond({ error: "Search limit unavailable." }, 503);
    if (slot.data !== true) return respond({ error: "Please wait before searching again." }, 429);
    const upstream = await fetchAcdb(
      `https://www.animecharactersdatabase.com/api_series_characters.php?character_q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "node-fetch/3.3.2 HiddenLewdStudios/1.0 (+https://hiddenlewdstudios.github.io/hiddenlewdstudios-repo/)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!upstream.ok) {
      const retryAfter = Number.parseInt(upstream.headers.get("retry-after") ?? "", 10);
      await admin.rpc("defer_acdb_requests", {
        delay_seconds: Number.isFinite(retryAfter) ? retryAfter : upstream.status === 429 ? 60 : 30,
      });
      providerDeferred = true;
      throw new Error("Character provider is unavailable.");
    }
    const results = normalizeResults(await upstream.json());
    const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
    await admin.from("character_search_cache").upsert({ query, results, expires_at: expiresAt });
    return respond({ results, cached: false, attribution: "Anime Characters Database" });
  } catch {
    if (!providerDeferred) await admin.rpc("defer_acdb_requests", { delay_seconds: 30 });
    return respond({
      results: [],
      cached: false,
      attribution: "Anime Characters Database",
      unavailable: true,
    });
  } finally {
    await admin.rpc("release_character_search_cache_miss", { search_query: query });
  }
});
