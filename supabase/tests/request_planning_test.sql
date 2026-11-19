BEGIN;
SELECT plan(5);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'planning-customer@example.test', '{}'::jsonb, '{}'::jsonb),
  ('aaaaaaaa-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'planning-metadata@example.test', '{}'::jsonb, '{"role":"owner"}'::jsonb),
  ('aaaaaaaa-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'planning-owner@example.test', '{"role":"owner"}'::jsonb, '{}'::jsonb);

insert into public.requests (id, user_id, supporter_platform, supporter_nickname, contact_email, tier, category, interview_question, credit_preference, creative_freedom)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-1111-4111-8111-111111111111', 'Test', 'Customer', 'planning-customer@example.test', 'Genin', 'Interview', 'Question', 'Credit', 'Balanced');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{},"user_metadata":{}}', true);
set local role authenticated;
select is((select count(*) from public.request_planning where request_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 0::bigint, 'customers cannot view planning');

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{},"user_metadata":{"role":"owner"}}', true);
set local role authenticated;
select throws_ok($$insert into public.request_planning (request_id, due_date, priority, updated_by) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-12-01', 'high', 'aaaaaaaa-2222-4222-8222-222222222222')$$, '42501', null, 'user_metadata cannot create planning rows');

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"owner"},"user_metadata":{}}', true);
set local role authenticated;
select lives_ok($$insert into public.request_planning (request_id, due_date, priority, updated_by) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-12-01', 'high', 'aaaaaaaa-3333-4333-8333-333333333333')$$, 'owners can create planning rows');
select is((select priority from public.request_planning where request_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 'high', 'owners can read planning rows');
select lives_ok($$update public.request_planning set due_date = '2026-12-15', priority = 'urgent', updated_by = 'aaaaaaaa-3333-4333-8333-333333333333' where request_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$, 'owners can update planning rows');

SELECT * FROM finish();
ROLLBACK;
