create table public.request_planning (
  request_id uuid primary key references public.requests (id) on delete cascade,
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index request_planning_priority_due_date_idx
on public.request_planning (priority, due_date);

create trigger request_planning_set_updated_at
before update on public.request_planning
for each row execute function public.set_updated_at();

alter table public.request_planning enable row level security;

create policy "Owners can view request planning"
on public.request_planning for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner');

create policy "Owners can add request planning"
on public.request_planning for insert to authenticated
with check (
  updated_by = (select auth.uid())
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);

create policy "Owners can update request planning"
on public.request_planning for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner')
with check (
  updated_by = (select auth.uid())
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);
