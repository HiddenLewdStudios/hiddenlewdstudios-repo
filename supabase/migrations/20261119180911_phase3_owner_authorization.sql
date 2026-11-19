-- Owner authorization is stored only in auth.users.raw_app_meta_data by a trusted
-- server-side administrator. raw_user_meta_data/user_metadata is user-editable and
-- must never be used for authorization.
--
-- These policies are intentionally read-only. Owner request management, status
-- changes, customer-facing updates, and staff notes are separate future work.

drop policy "Users can view their own requests" on public.requests;
create policy "Customers and owners can view requests"
on public.requests for select to authenticated
using (
  (select auth.uid()) = user_id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);

drop policy "Users can view characters for their own requests" on public.request_characters;
create policy "Customers and owners can view request characters"
on public.request_characters for select to authenticated
using (
  exists (
    select 1
    from public.requests
    where requests.id = request_characters.request_id
      and (
        requests.user_id = (select auth.uid())
        or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
      )
  )
);

drop policy "Users can view references for their own requests" on public.request_references;
create policy "Customers and owners can view request references"
on public.request_references for select to authenticated
using (
  exists (
    select 1
    from public.requests
    where requests.id = request_references.request_id
      and (
        requests.user_id = (select auth.uid())
        or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
      )
  )
);

drop policy "Users can view status history for their own requests" on public.request_status_history;
create policy "Customers and owners can view request status history"
on public.request_status_history for select to authenticated
using (
  exists (
    select 1
    from public.requests
    where requests.id = request_status_history.request_id
      and (
        requests.user_id = (select auth.uid())
        or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
      )
  )
);

-- The bucket remains private. This policy only permits an authenticated owner to
-- read existing request-reference objects; it does not make objects public or
-- grant owner write/delete access.
drop policy "Users can read their own request reference files" on storage.objects;
create policy "Customers and owners can read request reference files"
on storage.objects for select to authenticated
using (
  bucket_id = 'request-references'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
  )
);
