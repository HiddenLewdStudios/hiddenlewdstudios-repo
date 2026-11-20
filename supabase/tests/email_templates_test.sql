BEGIN;
SELECT plan(5);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('eeeeeeee-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'template-customer@example.test', '{}'::jsonb, '{}'::jsonb),
  ('eeeeeeee-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'template-metadata@example.test', '{}'::jsonb, '{"role":"owner"}'::jsonb),
  ('eeeeeeee-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'template-owner@example.test', '{"role":"owner"}'::jsonb, '{}'::jsonb);

select set_config('request.jwt.claims', '{"sub":"eeeeeeee-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{},"user_metadata":{}}', true);
set local role authenticated;
select is((select count(*) from public.email_templates), 0::bigint, 'customers cannot view email templates');

reset role;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{},"user_metadata":{"role":"owner"}}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.email_template_versions (template_key, subject, html_body, created_by) values ('customer_request_received', 'Unsafe', '<p>Unsafe</p>', 'eeeeeeee-2222-4222-8222-222222222222')$$,
  '42501',
  null,
  'user_metadata cannot create template versions'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"owner"},"user_metadata":{}}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.email_template_versions (template_key, subject, html_body, created_by) values ('customer_request_received', 'Owner version', '<p>Owner version</p>', 'eeeeeeee-3333-4333-8333-333333333333')$$,
  'owners can create immutable template versions'
);
select lives_ok(
  $$update public.email_templates set current_version_id = (select id from public.email_template_versions where subject = 'Owner version') where template_key = 'customer_request_received'$$,
  'owners can activate a version from the same template'
);
select throws_ok(
  $$update public.email_templates set current_version_id = (select id from public.email_template_versions where template_key = 'owner_new_request' limit 1) where template_key = 'customer_request_received'$$,
  '23514',
  null,
  'active versions cannot cross template boundaries'
);

SELECT * FROM finish();
ROLLBACK;
