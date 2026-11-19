BEGIN;
SELECT plan(10);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'customer@example.test',
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'metadata-owner@example.test',
    '{}'::jsonb,
    '{"role":"owner"}'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'owner@example.test',
    '{"role":"owner"}'::jsonb,
    '{}'::jsonb
  );

insert into public.requests (
  id,
  user_id,
  supporter_platform,
  supporter_nickname,
  contact_email,
  tier,
  category,
  interview_question,
  credit_preference,
  creative_freedom
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Test platform',
  'Customer',
  'customer@example.test',
  'Genin',
  'Interview',
  'Test question',
  'Credit customer',
  'Balanced'
);

insert into public.request_characters (
  request_id,
  position,
  character_name,
  version_label
)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'Test character', 'Default');

insert into public.request_references (
  request_id,
  storage_path,
  original_filename,
  mime_type,
  byte_size
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/reference.jpg',
  'reference.jpg',
  'image/jpeg',
  512
);

insert into storage.objects (bucket_id, name, owner_id)
values (
  'request-references',
  '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/reference.jpg',
  '11111111-1111-1111-1111-111111111111'
);

select is(
  (select public from storage.buckets where id = 'request-references'),
  false,
  'request reference bucket remains private'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{},"user_metadata":{}}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.requests where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'customers can still read only their own request'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'request-references'
      and name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/reference.jpg'
  ),
  1::bigint,
  'customers can still read only their own private reference object'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{},"user_metadata":{"role":"owner"}}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.requests where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'user_metadata cannot grant owner request access'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'request-references'
      and name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/reference.jpg'
  ),
  0::bigint,
  'user_metadata cannot grant owner Storage access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","app_metadata":{"role":"owner"},"user_metadata":{}}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.requests where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'owners can read requests'
);
select is(
  (
    select count(*)
    from public.request_characters
    where request_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  1::bigint,
  'owners can read characters'
);
select is(
  (
    select count(*)
    from public.request_references
    where request_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  1::bigint,
  'owners can read reference metadata'
);
select is(
  (
    select count(*)
    from public.request_status_history
    where request_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  1::bigint,
  'owners can read status history'
);
select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'request-references'
      and name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/reference.jpg'
  ),
  1::bigint,
  'owners can read private reference objects without making the bucket public'
);

SELECT * FROM finish();
ROLLBACK;
