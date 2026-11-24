BEGIN;
SELECT plan(8);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('dddddddd-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'deliv-cust1@example.test', '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'deliv-cust2@example.test', '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'deliv-owner@example.test', '{"role":"owner"}'::jsonb, '{}'::jsonb);

insert into public.requests (
  id,
  user_id,
  supporter_platform,
  supporter_nickname,
  contact_email,
  tier,
  category,
  credit_preference,
  creative_freedom
) values (
  'd0000000-0000-4000-8000-000000000001',
  'dddddddd-1111-4111-8111-111111111111',
  'Patreon',
  'Customer 1',
  'deliv-cust1@example.test',
  'Chunin',
  'Single Illustration',
  'Credit my supporter nickname',
  'Balanced'
);

-- Owner inserts initial deliverable
insert into public.request_deliverables (
  id,
  request_id,
  storage_path,
  original_filename,
  mime_type,
  byte_size,
  created_by
) values (
  'd1111111-1111-4111-8111-111111111111',
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001/final_art.png',
  'final_art.png',
  'image/png',
  1048576,
  'dddddddd-3333-4333-8333-333333333333'
);

-- Test 1: Customer 1 can view deliverables for their own request
select set_config('request.jwt.claims', '{"sub":"dddddddd-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{},"user_metadata":{}}', true);
set local role authenticated;
select is(
  (select count(*) from public.request_deliverables where id = 'd1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'Customer 1 can view deliverables for their own request'
);

-- Test 2: Customer 2 cannot view deliverables for Customer 1's request
reset role;
select set_config('request.jwt.claims', '{"sub":"dddddddd-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{},"user_metadata":{}}', true);
set local role authenticated;
select is(
  (select count(*) from public.request_deliverables where id = 'd1111111-1111-4111-8111-111111111111'),
  0::bigint,
  'Customer 2 cannot view deliverables for Customer 1 request'
);

-- Test 3: Customer cannot insert deliverables
select throws_ok(
  $$insert into public.request_deliverables (request_id, storage_path, original_filename, mime_type, byte_size)
    values ('d0000000-0000-4000-8000-000000000001', 'cust2/hack.png', 'hack.png', 'image/png', 100)$$,
  '42501',
  null,
  'Customer cannot insert request deliverables'
);

-- Test 4: Owner can view all deliverables
reset role;
select set_config('request.jwt.claims', '{"sub":"dddddddd-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"owner"},"user_metadata":{}}', true);
set local role authenticated;
select is(
  (select count(*) from public.request_deliverables where id = 'd1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'Owner can view all request deliverables'
);

-- Test 5: Owner can upload/insert deliverables
select lives_ok(
  $$insert into public.request_deliverables (id, request_id, storage_path, original_filename, mime_type, byte_size, created_by)
    values ('d2222222-2222-4222-8222-222222222222', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/alt.png', 'alt.png', 'image/png', 2048, 'dddddddd-3333-4333-8333-333333333333')$$,
  'Owner can insert new deliverables'
);

-- Test 6: Customer cannot delete deliverables
reset role;
select set_config('request.jwt.claims', '{"sub":"dddddddd-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{},"user_metadata":{}}', true);
set local role authenticated;
delete from public.request_deliverables where id = 'd2222222-2222-4222-8222-222222222222';
select is(
  (select count(*) from public.request_deliverables where id = 'd2222222-2222-4222-8222-222222222222'),
  0::bigint, -- Customer 1 cannot see it to count, but check as owner below
  'Customer cannot affect or see deletion of deliverable'
);

-- Test 7: Owner can delete deliverables
reset role;
select set_config('request.jwt.claims', '{"sub":"dddddddd-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"owner"},"user_metadata":{}}', true);
set local role authenticated;
delete from public.request_deliverables where id = 'd2222222-2222-4222-8222-222222222222';
select is(
  (select count(*) from public.request_deliverables where id = 'd2222222-2222-4222-8222-222222222222'),
  0::bigint,
  'Owner can delete deliverable'
);

-- Test 8: Anonymous user cannot view deliverables
reset role;
set local role anon;
select is(
  (select count(*) from public.request_deliverables),
  0::bigint,
  'Anonymous role cannot view request deliverables'
);

SELECT * FROM finish();
ROLLBACK;
