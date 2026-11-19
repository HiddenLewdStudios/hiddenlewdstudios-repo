create table public.request_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  recipient_kind text not null check (recipient_kind in ('customer', 'owner')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, recipient_kind)
);

create index request_notification_deliveries_request_id_idx
on public.request_notification_deliveries (request_id);

create index request_notification_deliveries_pending_idx
on public.request_notification_deliveries (status, created_at)
where status in ('pending', 'failed');

create trigger request_notification_deliveries_set_updated_at
before update on public.request_notification_deliveries
for each row execute function public.set_updated_at();

create function public.queue_request_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.request_notification_deliveries (request_id, recipient_kind)
  values
    (new.id, 'customer'),
    (new.id, 'owner');
  return new;
end;
$$;

create trigger requests_queue_notifications
after insert on public.requests
for each row execute function public.queue_request_notifications();

alter table public.request_notification_deliveries enable row level security;

create policy "Users can view notification status for their own requests"
on public.request_notification_deliveries for select to authenticated
using (
  exists (
    select 1
    from public.requests
    where requests.id = request_notification_deliveries.request_id
      and requests.user_id = (select auth.uid())
  )
);

revoke all on function public.queue_request_notifications() from public, anon, authenticated;
