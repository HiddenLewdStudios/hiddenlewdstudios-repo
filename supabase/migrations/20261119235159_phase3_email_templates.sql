-- Owner-managed email templates have immutable versions. The active version is
-- selected through a constrained pointer; customer data and credentials never
-- enter this editor.

create table public.email_templates (
  template_key text primary key check (template_key in ('customer_request_received', 'owner_new_request')),
  label text not null,
  current_version_id uuid,
  updated_at timestamptz not null default now()
);

create table public.email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_key text not null references public.email_templates (template_key) on delete cascade,
  subject text not null check (btrim(subject) <> '' and char_length(subject) <= 200),
  html_body text not null check (btrim(html_body) <> '' and char_length(html_body) <= 20000),
  is_default boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.email_templates
  add constraint email_templates_current_version_id_fkey
  foreign key (current_version_id) references public.email_template_versions (id);

create unique index email_template_versions_one_default_per_template_idx
on public.email_template_versions (template_key)
where is_default;

create index email_template_versions_template_created_at_idx
on public.email_template_versions (template_key, created_at desc);

alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;

revoke all on public.email_templates, public.email_template_versions from anon, authenticated;
grant select on public.email_templates, public.email_template_versions to authenticated;
grant insert on public.email_template_versions to authenticated;
grant update (current_version_id) on public.email_templates to authenticated;

create policy "Owners can view email templates"
on public.email_templates for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner');

create policy "Owners can select email template versions"
on public.email_template_versions for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner');

create policy "Owners can add email template versions"
on public.email_template_versions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner'
);

create policy "Owners can activate email template versions"
on public.email_templates for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'owner');

create function public.validate_email_template_current_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_version_id is not null and not exists (
    select 1
    from public.email_template_versions
    where id = new.current_version_id
      and template_key = new.template_key
  ) then
    raise exception 'The active version must belong to this template' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger email_templates_validate_current_version
before insert or update of current_version_id on public.email_templates
for each row execute function public.validate_email_template_current_version();

revoke all on function public.validate_email_template_current_version() from public, anon, authenticated;

insert into public.email_templates (template_key, label)
values
  ('customer_request_received', 'Customer request confirmation'),
  ('owner_new_request', 'Owner new-request alert');

insert into public.email_template_versions (template_key, subject, html_body, is_default)
values
  (
    'customer_request_received',
    'We received your request #{{request_number}}',
    '<h1>Request received</h1><p>Hi {{supporter_nickname}},</p><p>Your <strong>{{category}}</strong> request has been received.</p><p>Your request ID is <strong>#{{request_number}}</strong>. Keep it for your records.</p><p>Hidden Lewd Studio</p>',
    true
  ),
  (
    'owner_new_request',
    'New request #{{request_number}}',
    '<h1>New request received</h1><p><strong>Request:</strong> #{{request_number}}</p><p><strong>Supporter:</strong> {{supporter_nickname}}</p><p><strong>Contact:</strong> {{contact_email}}</p><p><strong>Tier:</strong> {{tier}}</p><p><strong>Category:</strong> {{category}}</p>',
    true
  );

update public.email_templates as template
set current_version_id = version.id
from public.email_template_versions as version
where version.template_key = template.template_key
  and version.is_default;
