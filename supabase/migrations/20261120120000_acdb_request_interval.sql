-- All character searches share one ACDB bot budget across edge workers.
create table public.acdb_request_clock (
  singleton boolean primary key check (singleton),
  available_at timestamptz not null,
  blocked_until timestamptz not null default '-infinity'
);
alter table public.acdb_request_clock enable row level security;
revoke all on public.acdb_request_clock from public, anon, authenticated;
grant select, update on public.acdb_request_clock to service_role;
insert into public.acdb_request_clock values (true, '-infinity');

create function public.reserve_acdb_request() returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.acdb_request_clock
     set available_at = clock_timestamp() + interval '1 second'
   where singleton
     and available_at <= clock_timestamp()
     and blocked_until <= clock_timestamp();
  return found;
end;
$$;
revoke all on function public.reserve_acdb_request() from public, anon, authenticated;
grant execute on function public.reserve_acdb_request() to service_role;

create function public.defer_acdb_requests(delay_seconds integer) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.acdb_request_clock
     set blocked_until = greatest(blocked_until, clock_timestamp() + make_interval(secs => greatest(1, least(delay_seconds, 300))));
end;
$$;
revoke all on function public.defer_acdb_requests(integer) from public, anon, authenticated;
grant execute on function public.defer_acdb_requests(integer) to service_role;
