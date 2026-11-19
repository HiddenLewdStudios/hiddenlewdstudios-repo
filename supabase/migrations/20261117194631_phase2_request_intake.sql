create sequence if not exists public.request_number_seq;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default (
    'HLS-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.request_number_seq')::text, 6, '0')
  ),
  user_id uuid not null references auth.users (id) on delete restrict,
  supporter_platform text not null,
  supporter_nickname text not null,
  contact_email text not null,
  tier text not null,
  category text not null,
  interview_question text,
  action text,
  context text,
  relation text,
  plot text,
  story_briefing text,
  credit_preference text not null,
  creative_freedom text not null,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (category = 'Interview' and interview_question is not null)
    or (category <> 'Interview' and action is not null and context is not null)
  )
);

create table public.request_characters (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  position smallint not null check (position > 0),
  character_name text not null,
  franchise text,
  version_label text not null,
  created_at timestamptz not null default now(),
  unique (request_id, position)
);

create table public.request_references (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now()
);

create table public.request_status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  status text not null check (status in ('submitted', 'in_review', 'accepted', 'in_progress', 'completed', 'cancelled')),
  note text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index requests_user_id_created_at_idx on public.requests (user_id, created_at desc);
create index request_characters_request_id_idx on public.request_characters (request_id);
create index request_references_request_id_idx on public.request_references (request_id);
create index request_status_history_request_id_idx on public.request_status_history (request_id, created_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger requests_set_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

create function public.record_initial_request_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.request_status_history (request_id, status, changed_by)
  values (new.id, new.status, new.user_id);
  return new;
end;
$$;

create trigger requests_record_initial_status
after insert on public.requests
for each row execute function public.record_initial_request_status();

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.request_characters enable row level security;
alter table public.request_references enable row level security;
alter table public.request_status_history enable row level security;

create policy "Users can view their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can view their own requests"
on public.requests for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can submit their own requests"
on public.requests for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'submitted');

create policy "Users can view characters for their own requests"
on public.request_characters for select to authenticated
using (
  exists (select 1 from public.requests where requests.id = request_characters.request_id and requests.user_id = (select auth.uid()))
);

create policy "Users can add characters to their own requests"
on public.request_characters for insert to authenticated
with check (
  exists (select 1 from public.requests where requests.id = request_characters.request_id and requests.user_id = (select auth.uid()))
);

create policy "Users can view references for their own requests"
on public.request_references for select to authenticated
using (
  exists (select 1 from public.requests where requests.id = request_references.request_id and requests.user_id = (select auth.uid()))
);

create policy "Users can add references to their own requests"
on public.request_references for insert to authenticated
with check (
  exists (select 1 from public.requests where requests.id = request_references.request_id and requests.user_id = (select auth.uid()))
);

create policy "Users can view status history for their own requests"
on public.request_status_history for select to authenticated
using (
  exists (select 1 from public.requests where requests.id = request_status_history.request_id and requests.user_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-references',
  'request-references',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own request reference files"
on storage.objects for select to authenticated
using (
  bucket_id = 'request-references'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can upload files for their own requests"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-references'
  and array_length(string_to_array(name, '/'), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.requests
    where requests.id::text = (storage.foldername(name))[2]
      and requests.user_id = (select auth.uid())
  )
);

create policy "Users can delete their own request reference files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'request-references'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.record_initial_request_status() from public, anon, authenticated;
