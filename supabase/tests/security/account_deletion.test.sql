-- Account deletion leaves no personal data behind (Faz 1, SEC).
-- Deleting the auth.users row (what delete-account does via auth.admin.deleteUser
-- in Faz 4) must cascade to every user table while the shared catalog survives.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'delete-me@test.local'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'keep-me@test.local');

insert into public.titles (tmdb_id, media_type, original_title) values (992001, 'tv', 'Deletion Show');
insert into public.seasons (title_id, season_number)
select id, 1 from public.titles where tmdb_id = 992001;
insert into public.episodes (season_id, title_id, season_number, episode_number)
select s.id, s.title_id, 1, 1 from public.seasons s join public.titles t on t.id = s.title_id
where t.tmdb_id = 992001;

insert into public.watchlist_items (user_id, title_id, notes)
select u, t.id, 'note' from public.titles t,
  unnest(array['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']::uuid[]) u
where t.tmdb_id = 992001;

insert into public.episode_progress (user_id, episode_id, title_id)
select u, e.id, e.title_id from public.episodes e join public.titles t on t.id = e.title_id,
  unnest(array['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']::uuid[]) u
where t.tmdb_id = 992001;

insert into public.rate_limits (user_id, bucket, window_start)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'tmdb', now());

-- ---------------------------------------------------------------------------
-- Delete the account
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ delete from auth.users where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  'deleting the auth user succeeds even with watchlist and progress rows'
);

select is(
  (select count(*)::int from public.profiles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  0, 'profile is removed'
);
select is(
  (select count(*)::int from public.watchlist_items where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  0, 'watchlist rows (incl. notes and ratings) are removed'
);
select is(
  (select count(*)::int from public.episode_progress where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  0, 'episode progress is removed'
);
select is(
  (select count(*)::int from public.rate_limits where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  0, 'rate limit counters are removed'
);

-- Other users and the shared catalog are untouched.
select is(
  (select count(*)::int from public.watchlist_items where user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  1, 'another user''s watchlist is untouched'
);
select is(
  (select count(*)::int from public.episode_progress where user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  1, 'another user''s progress is untouched'
);
select is(
  (select count(*)::int from public.titles where tmdb_id = 992001),
  1, 'catalog title survives account deletion'
);
select is(
  (select count(*)::int from public.episodes e join public.titles t on t.id = e.title_id where t.tmdb_id = 992001),
  1, 'catalog episodes survive account deletion'
);

-- ---------------------------------------------------------------------------
-- The deletion log holds no personal data and is closed to clients
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select column_name::text from information_schema.columns
     where table_schema = 'public' and table_name = 'account_deletion_log'
       and column_name not in ('id', 'user_id_hash', 'reason_code', 'deleted_at') $$,
  'account_deletion_log only has id, user_id_hash, reason_code, deleted_at'
);

select throws_ok(
  $$ insert into public.account_deletion_log (user_id_hash) values ('not-a-hash') $$,
  '23514', null, 'user_id_hash must be a SHA-256 hex digest'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "role": "authenticated"}', true);

select throws_ok(
  $$ insert into public.account_deletion_log (user_id_hash) values (repeat('a', 64)) $$,
  '42501', null, 'clients cannot write to account_deletion_log'
);

reset role;

select * from finish();
rollback;
