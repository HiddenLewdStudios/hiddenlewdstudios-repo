alter table public.profiles
  add column last_supporter_nickname text not null default '',
  add column last_supporter_platform text not null default '',
  add column last_shinobi_registration text not null default '';

update public.profiles
set last_supporter_nickname = display_name
where last_supporter_nickname = '';
