-- The proxy owns external character-data access. Cache and rate-limit state is
-- not exposed through the Data API.
create table public.character_search_cache (
  query text primary key check (char_length(query) between 2 and 80),
  results jsonb not null,
  expires_at timestamptz not null,
  fetched_at timestamptz not null default now()
);

create table public.character_search_inflight (
  query text primary key check (char_length(query) between 2 and 80),
  expires_at timestamptz not null
);

alter table public.character_search_cache enable row level security;
alter table public.character_search_inflight enable row level security;

revoke all on public.character_search_cache, public.character_search_inflight from anon, authenticated;

create function public.claim_character_search_cache_miss(search_query text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.character_search_inflight where expires_at <= clock_timestamp();
  insert into public.character_search_inflight (query, expires_at)
  values (search_query, clock_timestamp() + interval '15 seconds')
  on conflict (query) do nothing;
  return found;
end;
$$;

create function public.release_character_search_cache_miss(search_query text) returns void
language sql security invoker set search_path = '' as $$
  delete from public.character_search_inflight where query = search_query;
$$;

revoke all on function public.claim_character_search_cache_miss(text) from public, anon, authenticated;
revoke all on function public.release_character_search_cache_miss(text) from public, anon, authenticated;
grant execute on function public.claim_character_search_cache_miss(text) to service_role;
grant execute on function public.release_character_search_cache_miss(text) to service_role;
