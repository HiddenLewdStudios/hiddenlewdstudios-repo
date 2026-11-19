BEGIN;
SELECT plan(9);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  (
    '77777777-7777-7777-7777-777777777777',
    'authenticated',
    'authenticated',
    'status-customer@example.test',
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'authenticated',
    'authenticated',
    'status-metadata@example.test',
    '{}'::jsonb,
    '{"role":"owner"}'::jsonb
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'authenticated',
    'authenticated',
    'status-owner@example.test',
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
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '77777777-7777-7777-7777-777777777777',
  'Test platform',
  'Customer',
  'status-customer@example.test',
  'Genin',
  'Interview',
  'Test question',
  'Credit customer',
  'Balanced'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated","app_metadata":{},"user_metadata":{}}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.requests
    set status = 'in_review'
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $$,
  'customers cannot change request status'
);

select is(
  (
    select status
    from public.requests
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  'submitted',
  'a customer status update leaves the request unchanged'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated","app_metadata":{},"user_metadata":{"role":"owner"}}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.requests
    set status = 'in_review'
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $$,
  'user_metadata cannot grant status-update access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated","app_metadata":{"role":"owner"},"user_metadata":{}}',
  true
);
set local role authenticated;

select is(
  (
    select status
    from public.requests
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  'submitted',
  'a user_metadata escalation attempt leaves the request unchanged'
);

select lives_ok(
  $$
    update public.requests
    set status = 'in_review'
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $$,
  'owners can move submitted requests to in review'
);

select is(
  (
    select status
    from public.requests
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  'in_review',
  'the permitted status transition is persisted'
);

select is(
  (
    select changed_by
    from public.request_status_history
    where request_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and status = 'in_review'
  ),
  '99999999-9999-9999-9999-999999999999'::uuid,
  'the status history records the authenticated owner'
);

select throws_ok(
  $$
    update public.requests
    set status = 'completed'
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $$,
  '22023',
  'Invalid request status transition from in_review to completed',
  'owners cannot skip a required status transition'
);

select throws_ok(
  $$
    update public.requests
    set contact_email = 'changed@example.test'
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $$,
  '42501',
  null,
  'owners cannot update request fields other than status'
);

SELECT * FROM finish();
ROLLBACK;
