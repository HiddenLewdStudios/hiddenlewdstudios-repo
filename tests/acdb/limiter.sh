#!/usr/bin/env bash
# Run against a disposable local database with the migration applied.
set -euo pipefail
sql() { psql -XAtq -v ON_ERROR_STOP=1 "$@"; }
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
pids=()
for i in {1..6}; do
  sql -c "set role service_role; select public.reserve_acdb_request()" > "$out/result$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
test "$(grep -hx t "$out"/result* | wc -l)" -eq 1
test "$(grep -hx f "$out"/result* | wc -l)" -eq 5
sql <<'SQL'
do $$
declare started timestamptz; next_slot timestamptz;
begin
  update public.acdb_request_clock set available_at = '-infinity';
  started := clock_timestamp();
  if not public.reserve_acdb_request() then raise exception 'first permit denied'; end if;
  select available_at into next_slot from public.acdb_request_clock;
  if next_slot < started + interval '1 second' or public.reserve_acdb_request() then
    raise exception 'one-second cooldown violated';
  end if;
  perform pg_sleep(1.05);
  if not public.reserve_acdb_request() then raise exception 'permit failed to reopen'; end if;
  if has_function_privilege('anon','public.reserve_acdb_request()','execute')
     or has_function_privilege('authenticated','public.reserve_acdb_request()','execute') then
    raise exception 'public client can reserve slots';
  end if;
end $$;
SQL
