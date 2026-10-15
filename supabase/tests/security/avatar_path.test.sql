-- profiles.avatar_path integrity (SEC): own path accepted; others' and invalid paths rejected.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('a2000000-0000-4000-8000-0000000000a2', 'avatar-a@test.local'),
  ('b2000000-0000-4000-8000-0000000000b2', 'avatar-b@test.local');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "a2000000-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);

-- Accepted
select lives_ok(
  $$ update public.profiles set avatar_path = 'a2000000-0000-4000-8000-0000000000a2/avatar.png' $$,
  'own folder + file name is accepted'
);
select is(
  (select avatar_path from public.profiles),
  'a2000000-0000-4000-8000-0000000000a2/avatar.png',
  'own path is stored'
);
select lives_ok(
  $$ update public.profiles set avatar_path = 'a2000000-0000-4000-8000-0000000000a2/v2_photo-1.webp' $$,
  'letters, digits, dot, dash and underscore are allowed'
);
select lives_ok($$ update public.profiles set avatar_path = null $$, 'NULL (no avatar) is accepted');

-- Rejected
select throws_ok(
  $$ update public.profiles set avatar_path = 'b2000000-0000-4000-8000-0000000000b2/avatar.png' $$,
  '23514', null, 'another user''s folder is rejected'
);
select throws_ok(
  $$ update public.profiles set avatar_path = 'avatar.png' $$,
  '23514', null, 'a path without the owner folder is rejected'
);
select throws_ok(
  $$ update public.profiles set avatar_path = 'a2000000-0000-4000-8000-0000000000a2/../b2000000-0000-4000-8000-0000000000b2/x.png' $$,
  '23514', null, 'path traversal is rejected'
);
select throws_ok(
  $$ update public.profiles set avatar_path = 'a2000000-0000-4000-8000-0000000000a2/sub/avatar.png' $$,
  '23514', null, 'nested folders are rejected'
);
select throws_ok(
  $$ update public.profiles set avatar_path = 'a2000000-0000-4000-8000-0000000000a2-evil/avatar.png' $$,
  '23514', null, 'a look-alike prefix of the user id is rejected'
);
select throws_ok(
  $$ update public.profiles set avatar_path = 'https://evil.example/a2000000-0000-4000-8000-0000000000a2/x.png' $$,
  '23514', null, 'absolute URLs are rejected'
);
select throws_ok(
  $$ update public.profiles set avatar_path = 'a2000000-0000-4000-8000-0000000000a2/' $$,
  '23514', null, 'a folder without a file name is rejected'
);

-- The constraint also binds privileged writers (e.g. a buggy server job).
reset role;
select throws_ok(
  $$ update public.profiles set avatar_path = 'a2000000-0000-4000-8000-0000000000a2/x.png'
     where id = 'b2000000-0000-4000-8000-0000000000b2' $$,
  '23514', null, 'even the superuser cannot store a path outside the row owner''s folder'
);

select * from finish();
rollback;
