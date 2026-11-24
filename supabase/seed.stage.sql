-- Staging Database Seed File
-- Populates hiddenlewdstudios-stage with test accounts and sample requests for sandbox testing.
-- Run via: Supabase Dashboard -> SQL Editor, or via Supabase CLI.

-- 1. Test Authentication Users
with local_users (id, email, app_metadata, display_name) as (
  values
    (
      '11111111-1111-4111-8111-111111111111'::uuid,
      'abu@gmail.com',
      '{"provider":"email","providers":["email"],"role":"owner"}'::jsonb,
      'Abu (staging owner)'
    ),
    (
      '22222222-2222-4222-8222-222222222222'::uuid,
      'abu2@gmail.com',
      '{"provider":"email","providers":["email"]}'::jsonb,
      'Abu Two (staging customer)'
    )
)
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  email,
  crypt('ChangeMe!LocalOnly2026', gen_salt('bf')),
  now(),
  app_metadata,
  jsonb_build_object('display_name', display_name),
  now(),
  now(),
  '',
  '',
  '',
  ''
from local_users
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  confirmation_token = coalesce(excluded.confirmation_token, ''),
  recovery_token = coalesce(excluded.recovery_token, ''),
  email_change_token_new = coalesce(excluded.email_change_token_new, ''),
  email_change = coalesce(excluded.email_change, ''),
  updated_at = excluded.updated_at;

-- 2. Auth Identities
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    'abu@gmail.com',
    '11111111-1111-4111-8111-111111111111'::uuid,
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"abu@gmail.com","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    'abu2@gmail.com',
    '22222222-2222-4222-8222-222222222222'::uuid,
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"abu2@gmail.com","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  )
on conflict on constraint identities_provider_id_provider_unique do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = excluded.updated_at;

-- 3. User Profiles
insert into public.profiles (
  id,
  display_name,
  last_supporter_nickname,
  last_supporter_platform,
  last_shinobi_registration
)
values
  (
    '11111111-1111-4111-8111-111111111111'::uuid,
    'Abu (staging owner)',
    'Abu',
    'SubscribeStar',
    'Kage'
  ),
  (
    '22222222-2222-4222-8222-222222222222'::uuid,
    'Abu Two (staging customer)',
    'Abu Two',
    'Fanbox',
    'Chunin'
  )
on conflict (id) do update
set
  display_name = excluded.display_name,
  last_supporter_nickname = excluded.last_supporter_nickname,
  last_supporter_platform = excluded.last_supporter_platform,
  last_shinobi_registration = excluded.last_shinobi_registration;

-- 4. Sample Requests
insert into public.requests (
  id,
  request_number,
  user_id,
  supporter_platform,
  supporter_nickname,
  contact_email,
  tier,
  category,
  interview_question,
  action,
  context,
  relation,
  plot,
  story_briefing,
  credit_preference,
  creative_freedom,
  status,
  created_at
)
values
  (
    '00000000-0000-4000-8000-000000000101'::uuid,
    'HLS-STG-000101',
    '22222222-2222-4222-8222-222222222222'::uuid,
    'Ko-fi',
    'Abu Two',
    'abu2@gmail.com',
    'Full illustration',
    'Illustration',
    null,
    'Reading together',
    'A quiet library after closing',
    'Friends',
    'Soft evening lighting.',
    'Use the attached references for wardrobe tone.',
    'Credit Abu Two',
    'Medium',
    'accepted',
    now() - interval '18 days'
  ),
  (
    '00000000-0000-4000-8000-000000000102'::uuid,
    'HLS-STG-000102',
    '22222222-2222-4222-8222-222222222222'::uuid,
    'Ko-fi',
    'Abu Two',
    'abu2@gmail.com',
    'Sketch',
    'Illustration',
    null,
    'Walking home',
    'A city street in rain',
    'Partners',
    'Neon reflections and umbrellas.',
    'Focus on the composition.',
    'Anonymous',
    'High',
    'in_progress',
    now() - interval '12 days'
  ),
  (
    '00000000-0000-4000-8000-000000000103'::uuid,
    'HLS-STG-000103',
    '22222222-2222-4222-8222-222222222222'::uuid,
    'Ko-fi',
    'Abu Two',
    'abu2@gmail.com',
    'Portrait',
    'Interview',
    'What makes this character memorable to you?',
    null,
    null,
    null,
    null,
    null,
    'Credit Abu Two',
    'Low',
    'completed',
    now() - interval '30 days'
  ),
  (
    '00000000-0000-4000-8000-000000000104'::uuid,
    'HLS-STG-000104',
    '22222222-2222-4222-8222-222222222222'::uuid,
    'Ko-fi',
    'Abu Two',
    'abu2@gmail.com',
    'Sketch',
    'Illustration',
    null,
    'Meeting at a cafe',
    'A bright Sunday morning',
    'Classmates',
    'Keep the background minimal.',
    'No external references needed.',
    'Anonymous',
    'Medium',
    'cancelled',
    now() - interval '6 days'
  )
on conflict (id) do update
set
  status = excluded.status,
  updated_at = now();

-- 5. Characters attached to requests
insert into public.request_characters (request_id, position, character_name, franchise, version_label)
values
  ('00000000-0000-4000-8000-000000000101'::uuid, 1, 'Fixture Character One', 'Fixture Series', 'Default'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 1, 'Fixture Character Two', 'Fixture Series', 'Rain outfit'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 1, 'Fixture Character Three', 'Fixture Series', 'Default')
on conflict (request_id, position) do update
set
  character_name = excluded.character_name,
  franchise = excluded.franchise,
  version_label = excluded.version_label;

-- 6. Customer updates
insert into public.request_customer_updates (request_id, message, created_by, created_at)
values
  (
    '00000000-0000-4000-8000-000000000102'::uuid,
    'Staging fixture: line work is underway.',
    '11111111-1111-4111-8111-111111111111'::uuid,
    now() - interval '2 days'
  )
on conflict do nothing;

-- 7. Internal notes
insert into public.request_internal_notes (request_id, note, created_by, created_at)
values
  (
    '00000000-0000-4000-8000-000000000102'::uuid,
    'Staging fixture: confirm color palette before rendering.',
    '11111111-1111-4111-8111-111111111111'::uuid,
    now() - interval '2 days'
  )
on conflict do nothing;

-- 8. Planning entries
insert into public.request_planning (request_id, due_date, priority, updated_by)
values
  (
    '00000000-0000-4000-8000-000000000102'::uuid,
    current_date + 7,
    'high',
    '11111111-1111-4111-8111-111111111111'::uuid
  ),
  (
    '00000000-0000-4000-8000-000000000101'::uuid,
    current_date + 14,
    'normal',
    '11111111-1111-4111-8111-111111111111'::uuid
  )
on conflict (request_id) do update
set
  due_date = excluded.due_date,
  priority = excluded.priority,
  updated_by = excluded.updated_by,
  updated_at = now();
