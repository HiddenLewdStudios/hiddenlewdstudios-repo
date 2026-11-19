-- Customer-visible updates and staff-only notes are separate immutable records.
-- Neither table uses user-editable metadata for authorization.

create table public.request_customer_updates (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  message text not null check (btrim(message) <> '' and char_length(message) <= 5000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.request_internal_notes (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  note text not null check (btrim(note) <> '' and char_length(note) <= 10000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index request_customer_updates_request_id_created_at_idx
on public.request_customer_updates (request_id, created_at);

create index request_internal_notes_request_id_created_at_idx
on public.request_internal_notes (request_id, created_at);

alter table public.request_customer_updates enable row level security;
alter table public.request_internal_notes enable row level security;

create policy "Customers and owners can view customer updates"
on public.request_customer_updates for select to authenticated
using (
  exists (
    select 1
    from public.requests
    where requests.id = request_customer_updates.request_id
      and (
        requests.user_id = (select auth.uid())
        or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
      )
  )
);

create policy "Owners can add customer updates"
on public.request_customer_updates for insert to authenticated
with check (
  created_by = (select auth.uid())
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);

create policy "Owners can view internal notes"
on public.request_internal_notes for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner');

create policy "Owners can add internal notes"
on public.request_internal_notes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);
