BEGIN;
SELECT plan(6);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('iiiiiiii-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'intake-cust1@example.test', '{}'::jsonb, '{}'::jsonb),
  ('iiiiiiii-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'intake-cust2@example.test', '{}'::jsonb, '{}'::jsonb),
  ('iiiiiiii-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'intake-owner@example.test', '{"role":"owner"}'::jsonb, '{}'::jsonb);

-- Test 1: Customer 1 can insert a request for their own user_id
select set_config('request.jwt.claims', '{"sub":"iiiiiiii-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{},"user_metadata":{}}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.requests (
      id, user_id, supporter_platform, supporter_nickname, contact_email, tier, category, credit_preference, creative_freedom
    ) values (
      'i0000000-0000-4000-8000-000000000001',
      'iiiiiiii-1111-4111-8111-111111111111',
      'Patreon',
      'Cust1',
      'intake-cust1@example.test',
      'Chunin',
      'Single Illustration',
      'Credit my supporter nickname',
      'Balanced'
    )$$,
  'Customer can insert a request with their own user_id'
);

-- Test 2: Customer 1 cannot insert a request for Customer 2
select throws_ok(
  $$insert into public.requests (
      id, user_id, supporter_platform, supporter_nickname, contact_email, tier, category, credit_preference, creative_freedom
    ) values (
      'i0000000-0000-4000-8000-000000000002',
      'iiiiiiii-2222-4222-8222-222222222222',
      'Patreon',
      'Impersonator',
      'hacker@example.test',
      'Chunin',
      'Single Illustration',
      'Credit my supporter nickname',
      'Balanced'
    )$$,
  '42501',
  null,
  'Customer cannot insert a request for another user'
);

-- Test 3: Customer 1 can view their own request
select is(
  (select count(*) from public.requests where id = 'i0000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Customer 1 can view their own request'
);

-- Test 4: Customer 2 cannot view Customer 1 request
reset role;
select set_config('request.jwt.claims', '{"sub":"iiiiiiii-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{},"user_metadata":{}}', true);
set local role authenticated;
select is(
  (select count(*) from public.requests where id = 'i0000000-0000-4000-8000-000000000001'),
  0::bigint,
  'Customer 2 cannot view Customer 1 request'
);

-- Test 5: Owner can view all requests
reset role;
select set_config('request.jwt.claims', '{"sub":"iiiiiiii-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"owner"},"user_metadata":{}}', true);
set local role authenticated;
select is(
  (select count(*) from public.requests where id = 'i0000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Owner can view requests from any customer'
);

-- Test 6: Anonymous user cannot view requests
reset role;
set local role anon;
select is(
  (select count(*) from public.requests),
  0::bigint,
  'Anonymous role cannot view requests'
);

SELECT * FROM finish();
ROLLBACK;
