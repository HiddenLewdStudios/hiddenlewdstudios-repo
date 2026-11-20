import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../../supabase/functions/character-search/index.ts", import.meta.url),
  "utf8",
);

// Only these two imports can resolve. The handler gets no global fetch or socket API.
async function fixture({
  cache = {},
  claim = { data: true },
  slot = { data: true },
  upstreamStatus = 200,
} = {}) {
  let handler;
  const events = [];
  const requests = [];
  const writes = [];
  const db = {
    from(table) {
      assert.equal(table, "character_search_cache");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gt() {
          return this;
        },
        maybeSingle() {
          return table === "character_search_cache" ? cache : client;
        },
        upsert(row) {
          writes.push({ table, row });
        },
      };
    },
    rpc(name) {
      if (name === "claim_character_search_cache_miss") {
        events.push("claim");
        return claim;
      }
      if (name === "reserve_acdb_request") {
        events.push("reserve");
        return slot;
      }
      assert.ok(["defer_acdb_requests", "release_character_search_cache_miss"].includes(name));
      events.push(name === "defer_acdb_requests" ? "defer" : "release");
      return { data: null };
    },
  };
  const transport = async (url, options) => {
    events.push("fetch");
    requests.push({ url, options });
    return Response.json(
      { search_results: [{ id: 2653, name: "Konata Izumi", anime_name: "Lucky Star" }] },
      { status: upstreamStatus },
    );
  };
  const context = vm.createContext({
    URL,
    AbortSignal,
    Response,
    TextEncoder,
    crypto: webcrypto,
    Deno: {
      env: { get: (key) => (key === "ACDB_EXTERNAL_ENABLED" ? "true" : "test") },
      serve: (callback) => {
        handler = callback;
      },
    },
  });
  const imports = {
    "npm:@supabase/supabase-js@2.119.0": { createClient: () => db },
    "npm:node-fetch@3.3.2": { default: transport },
  };
  const module = new vm.SourceTextModule(stripTypeScriptTypes(source), { context });
  await module.link((name) => {
    assert.ok(Object.hasOwn(imports, name), "Unreviewed dependency: " + name);
    const exports = imports[name];
    return new vm.SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      },
      { context },
    );
  });
  await module.evaluate();
  return {
    events,
    requests,
    writes,
    search(query = "Konata", method = "POST") {
      return handler(
        new Request("https://example.invalid/", {
          method,
          headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: method === "POST" ? JSON.stringify({ q: query }) : undefined,
        }),
      );
    },
  };
}

test("one reserved request uses the approved client identity and never follows redirects", async () => {
  const f = await fixture();
  const response = await f.search(" KONAta ");
  assert.deepEqual(f.events, ["claim", "reserve", "fetch", "release"]);
  const [{ url, options }] = f.requests;
  assert.equal(
    url,
    "https://www.animecharactersdatabase.com/api_series_characters.php?character_q=konata",
  );
  assert.match(options.headers["User-Agent"], /^node-fetch\/3\.3\.2 HiddenLewdStudios\//);
  assert.equal(options.redirect, "error");
  assert.equal((await response.json()).results[0].name, "Konata Izumi");
  assert.ok(
    f.writes.some(({ table, row }) => table === "character_search_cache" && row.query === "konata"),
  );
});

for (const [name, setup, status, events] of [
  ["cache hit", { cache: { data: { results: [] } } }, 200, []],
  ["cache error", { cache: { error: true } }, 503, []],
  ["global limit", { slot: { data: false } }, 429, ["claim", "reserve", "release"]],
  ["missing permit", { slot: { data: null } }, 429, ["claim", "reserve", "release"]],
  ["limiter error", { slot: { data: true, error: true } }, 503, ["claim", "reserve", "release"]],
]) {
  test(name + " sends no upstream request", async () => {
    const f = await fixture(setup);
    assert.equal((await f.search()).status, status);
    assert.deepEqual(f.events, events);
  });
}

test("invalid input and unsupported methods consume no permit", async () => {
  const f = await fixture();
  for (const [query, method, status] of [
    ["x", "POST", 400],
    ["x".repeat(81), "POST", 400],
    ["valid", "PUT", 405],
    ["valid", "OPTIONS", 200],
  ]) {
    assert.equal((await f.search(query, method)).status, status);
  }
  assert.deepEqual(f.events, []);
});

for (const status of [403, 429, 503]) {
  test("provider " + status + " triggers no retry or cached success", async () => {
    const f = await fixture({ upstreamStatus: status });
    assert.equal((await (await f.search()).json()).unavailable, true);
    assert.deepEqual(f.events, ["claim", "reserve", "fetch", "defer", "release"]);
    assert.ok(!f.writes.some(({ table }) => table === "character_search_cache"));
  });
}
