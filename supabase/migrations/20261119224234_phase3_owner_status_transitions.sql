-- Only an authenticated owner may change a request status. The transition
-- validator records each accepted change in the existing immutable history.

revoke update on table public.requests from anon, authenticated;
grant update (status) on table public.requests to authenticated;

create policy "Owners can update request status"
on public.requests for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner');

create function public.validate_and_record_owner_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if ((select auth.jwt()) -> 'app_metadata' ->> 'role') is distinct from 'owner' then
    raise exception 'Only owners can change request status'
      using errcode = '42501';
  end if;

  if not (
    (old.status = 'submitted' and new.status in ('in_review', 'cancelled'))
    or (old.status = 'in_review' and new.status in ('accepted', 'cancelled'))
    or (old.status = 'accepted' and new.status in ('in_progress', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'Invalid request status transition from % to %', old.status, new.status
      using errcode = '22023';
  end if;

  insert into public.request_status_history (request_id, status, changed_by)
  values (new.id, new.status, (select auth.uid()));

  return new;
end;
$$;

create trigger requests_validate_and_record_owner_status_change
before update of status on public.requests
for each row execute function public.validate_and_record_owner_status_change();

revoke all on function public.validate_and_record_owner_status_change() from public, anon, authenticated;
