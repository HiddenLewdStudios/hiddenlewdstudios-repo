with latest_requests as (
  select distinct on (user_id)
    user_id,
    supporter_nickname,
    supporter_platform,
    tier
  from public.requests
  order by user_id, created_at desc
)
update public.profiles as profile
set
  last_supporter_nickname = coalesce(nullif(profile.last_supporter_nickname, ''), latest.supporter_nickname),
  last_supporter_platform = coalesce(nullif(profile.last_supporter_platform, ''), latest.supporter_platform),
  last_shinobi_registration = coalesce(nullif(profile.last_shinobi_registration, ''), latest.tier)
from latest_requests as latest
where profile.id = latest.user_id
  and (
    profile.last_supporter_nickname = ''
    or profile.last_supporter_platform = ''
    or profile.last_shinobi_registration = ''
  );
