# ACDB API reference — 2026-11-20

Source archive reviewed: user-provided wiki_animecharactersdatabase.rar. The archived Wiki page was
last edited 2026-01-05 and identifies revision 674. This is a working implementation reference,
not a substitute for rechecking current provider rules before a live change.

## Access rules

- Character search endpoint: api_series_characters.php?character_q=STRING.
- ACDB requires cookies unless the request has an allowlisted User-Agent. The archived allowlist
  includes a User-Agent beginning with node-fetch.
- Limit the shared bot to one upstream request per second. Cache hits must not consume a permit.
- Follow no redirects. Do not retry upstream requests automatically.
- The API is supplied as-is.

## Data and licensing

- Archive includes MariaDB dumps: characters.sql.gz (about 37 MB unpacked), publishers.sql.gz
  (about 8 MB), and assignments.sql.gz (about 3 MB).
- The archived Wiki links the dumps to ODbL 1.0. Public use requires attribution. Public adapted
  databases require ODbL share-alike. Keep source/license notices when redistributing data.
- This project uses search responses only. It does not import, redistribute, or derive a local
  database from the dumps.

## Implementation controls

- Authenticated callers only; unauthenticated users retain the local catalog fallback.
- Cache-first lookup, same-query cache-miss coalescing, shared Postgres atomic permit, one-second
  minimum interval.
- Shared cooldown for upstream 429/5xx/network failure; honor Retry-After when present.
- No redirects, no automatic retries, no browser-to-ACDB traffic.
- UI attribution: Anime Characters Database and ODbL link, plus source link for every selected
  external suggestion.
- Local development and CI hard-disable external traffic. `npm run test:acdb` uses only handler
  fixtures; run `tests/acdb/limiter.sh` only with fresh disposable Postgres.

## Live rule recheck — 2026-11-20

The API page still lists `character_q` character search. The public terms still prohibit scrapers
and scanners. The Wiki API-access page returned an upstream error during this recheck, so its
archived one-request-per-second and recognized-User-Agent guidance remains the implementation
reference. Recheck that page before any future change that could increase provider traffic.
