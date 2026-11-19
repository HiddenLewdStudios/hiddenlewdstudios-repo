BEGIN;
SELECT plan(9);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  (
    '44444444-4444-4444-4444-444444444444',
    'authenticated',
    'authenticated',
    'communications-customer@example.test',
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'authenticated',
    'authenticated',
    'communications-metadata@example.test',
    '{}'::jsonb,
    '{"role":"owner"}'::jsonb
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'authenticated',
    'authenticated',
    'communications-owner@example.test',
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
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '44444444-4444-4444-4444-444444444444',
  'Test platform',
  'Customer',
  'communications-customer@example.test',
  'Genin',
  'Interview',
  'Test question',
  'Credit customer',
  'Balanced'
);

insert into public.request_customer_updates (request_id, message, created_by)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Your request has passed review.',
  '66666666-6666-6666-6666-666666666666'
);

insert into public.request_internal_notes (request_id, note, created_by)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Confirm the reference palette before starting.',
  '66666666-6666-6666-6666-666666666666'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","app_metadata":{},"user_metadata":{}}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.request_customer_updates
    where request_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  1::bigint,
  'customers can view customer-visible updates for their own requests'
);

select is(
  (
    select count(*)
    from public.request_internal_notes
    where request_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  0::bigint,
  'customers cannot view internal notes'
);

select throws_ok(
  $$
    insert into public.request_customer_updates (request_id, message, created_by)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'Customer-authored update',
      '44444444-4444-4444-4444-444444444444'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "request_customer_updates"',
  'customers cannot create customer-visible updates'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","app_metadata":{},"user_metadata":{"role":"owner"}}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.request_customer_updates
    where request_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  0::bigint,
  'user_metadata cannot grant customer-update access'
);

select is(
  (
    select count(*)
    from public.request_internal_notes
    where request_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  0::bigint,
  'user_metadata cannot grant internal-note access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","app_metadata":{"role":"owner"},"user_metadata":{}}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.request_customer_updates
    where request_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  1::bigint,
  'owners can view customer-visible updates'
);

select lives_ok(
  $$
    insert into public.request_customer_updates (request_id, message, created_by)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'Owner-authored update',
      '66666666-6666-6666-6666-666666666666'
    )
  $$,
  'owners can create customer-visible updates'
);

select is(
  (
    select count(*)
    from public.request_internal_notes
    where request_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  1::bigint,
  'owners can view internal notes'
);

select lives_ok(
  $$
    insert into public.request_internal_notes (request_id, note, created_by)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'Owner-only note',
      '66666666-6666-6666-6666-666666666666'
    )
  $$,
  'owners can create internal notes'
);

SELECT * FROM finish();
ROLLBACK;
