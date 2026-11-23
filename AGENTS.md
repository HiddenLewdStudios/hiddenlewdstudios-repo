# ACDB integration

Before any live ACDB use, test, or deployment, all repository tests must pass on the exact revision and the ACDB integration must receive careful review. A green suite alone does not authorize live traffic. Keep routine development, CI, and regression tests offline from ACDB. Use fixtures for responses and disposable local Postgres for the global limiter.

Review the edge function, every outbound request path, the shared database permit, and attribution against the [ACDB API Access rules](http://wiki.animecharactersdatabase.com/index.php?title=API_Access). Recheck the current rules before live use. ACDB limits the bot to one request per second across all users and workers. Deployments using the same bot must share its budget. Every upstream attempt requires a fresh atomic permit. Denied or unavailable permits must stop the request. Cache hits must avoid upstream traffic. Redirects and retries must never create unmetered requests.

ACDB requires cookies unless the HTTP client uses a recognized user agent. Keep the real client and its identifying User-Agent aligned with ACDB’s current list. Preserve source credit and the Open Database License link.

Run `npm run test:acdb` for the network-isolated handler suite. The ACDB offline gate also applies the limiter migration to disposable Postgres and runs `bash tests/acdb/limiter.sh`. That script changes the permit clock. Use only a fresh test database. Review the permission checks, concurrency results, and minimum interval before approving live use. Any necessary live verification must go through the reviewed, rate-limited function after all tests pass.
