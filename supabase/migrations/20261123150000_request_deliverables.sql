-- Finished Deliverable Access: Allows owners to upload completed commission deliverables
-- (illustrations, image sets, or story documents) and grants customers secure, authenticated
-- access to download them.

create table public.request_deliverables (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) >= 1 and char_length(original_filename) <= 255),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 104857600),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index request_deliverables_request_id_idx on public.request_deliverables (request_id);

alter table public.request_deliverables enable row level security;

-- Customers can view deliverables for their own requests; owners can view all deliverables
create policy "Customers and owners can view request deliverables"
on public.request_deliverables for select to authenticated
using (
  exists (
    select 1 from public.requests
    where requests.id = request_deliverables.request_id
      and requests.user_id = (select auth.uid())
  )
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);

-- Only owners can insert deliverables
create policy "Owners can upload request deliverables"
on public.request_deliverables for insert to authenticated
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
  and (created_by is null or created_by = (select auth.uid()))
);

-- Only owners can delete deliverables
create policy "Owners can delete request deliverables"
on public.request_deliverables for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner');

-- Ensure private storage bucket exists
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-deliverables',
  'request-deliverables',
  false,
  104857600,
  null
)
on conflict (id) do update set
  public = false,
  file_size_limit = 104857600;

-- Storage policies for request-deliverables
create policy "Customers and owners can read request deliverable files"
on storage.objects for select to authenticated
using (
  bucket_id = 'request-deliverables'
  and (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
    or exists (
      select 1 from public.requests
      where (requests.id)::text = (storage.foldername(name))[1]
        and requests.user_id = (select auth.uid())
    )
  )
);

create policy "Owners can upload request deliverable files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-deliverables'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);

create policy "Owners can delete request deliverable files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'request-deliverables'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);
