-- RLS isolation between users, and anon lock-out (Faz 1, SEC).
-- User A acts against user B's data; every attempt must be invisible or rejected.
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rls-a@test.local'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rls-b@test.local');

insert into public.titles (tmdb_id, media_type, original_title)
values (991001, 'tv', 'RLS Show'), (991002, 'tv', 'RLS Show 2');
insert into public.seasons (title_id, season_number)
select id, 1 from public.titles where tmdb_id in (991001, 991002);
insert into public.episodes (season_id, title_id, season_number, episode_number)
select s.id, s.title_id, 1, n
from public.seasons s join public.titles t on t.id = s.title_id, generate_series(1, 2) n
where t.tmdb_id in (991001, 991002);

insert into public.watchlist_items (user_id, title_id, notes)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id, 'A private note' from public.titles where tmdb_id = 991001;
insert into public.watchlist_items (user_id, title_id, notes)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, 'B private note' from public.titles where tmdb_id = 991001;

insert into public.episode_progress (user_id, episode_id, title_id)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', e.id, e.title_id
from public.episodes e join public.titles t on t.id = e.title_id
where t.tmdb_id = 991001 and e.episode_number = 1;

insert into public.rate_limits (user_id, bucket, window_start)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tmdb', now());

-- ---------------------------------------------------------------------------
-- Act as user A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

-- watchlist_items
select results_eq(
  $$ select notes from public.watchlist_items $$,
  array['A private note'],
  'A sees only their own watchlist rows'
);

select lives_ok(
  $$ insert into public.watchlist_items (title_id) select id from public.titles where tmdb_id = 991002 $$,
  'A can add a title; user_id defaults to auth.uid()'
);

select is(
  (select count(*)::int from public.watchlist_items where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  2,
  'the inserted row belongs to A'
);

select throws_ok(
  $$ insert into public.watchlist_items (user_id, title_id)
     select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id from public.titles where tmdb_id = 991002 $$,
  '42501', null, 'A cannot insert a row on behalf of B'
);

select throws_ok(
  $$ update public.watchlist_items set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'A cannot reassign rows to another user'
);

select throws_ok(
  $$ update public.watchlist_items set title_id = title_id $$,
  '42501', null, 'title_id is immutable for clients'
);

update public.watchlist_items set notes = 'tampered' where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
delete from public.watchlist_items where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select lives_ok(
  $$ update public.watchlist_items set status = 'watching', rating = 8 $$,
  'A can update status and rating on their own rows'
);

-- episode_progress
select is_empty(
  $$ select 1 from public.episode_progress $$,
  'A cannot see B''s episode progress'
);

select lives_ok(
  $$ insert into public.episode_progress (episode_id, title_id)
     select e.id, e.title_id from public.episodes e join public.titles t on t.id = e.title_id
     where t.tmdb_id = 991001 and e.episode_number = 2 $$,
  'A can mark an episode as watched'
);

select throws_ok(
  $$ insert into public.episode_progress (user_id, episode_id, title_id)
     select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', e.id, e.title_id from public.episodes e
     join public.titles t on t.id = e.title_id where t.tmdb_id = 991002 and e.episode_number = 1 $$,
  '42501', null, 'A cannot mark episodes for B'
);

select throws_ok(
  $$ update public.episode_progress set watched_at = now() $$,
  '42501', null, 'episode progress cannot be updated (insert/delete only)'
);

delete from public.episode_progress where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- profiles
select results_eq(
  $$ select id from public.profiles $$,
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
  'A sees only their own profile'
);

select lives_ok(
  $$ update public.profiles set display_name = 'Ayşe', locale = 'en' $$,
  'A can update their own profile settings'
);

select throws_ok(
  $$ update public.profiles set id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'profile id is immutable for clients'
);

update public.profiles set display_name = 'hijacked' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $$ delete from public.profiles $$,
  '42501', null, 'clients cannot delete profiles directly'
);

-- catalog
select isnt_empty($$ select 1 from public.titles $$, 'signed-in users can read the catalog');

select throws_ok(
  $$ insert into public.titles (tmdb_id, media_type, original_title) values (991999, 'movie', 'Injected') $$,
  '42501', null, 'clients cannot write to the catalog'
);

select throws_ok(
  $$ update public.episodes set air_date = current_date $$,
  '42501', null, 'clients cannot modify catalog episodes'
);

-- internal tables
select throws_ok($$ select * from public.rate_limits $$, '42501', null, 'rate_limits is not readable by clients');
select throws_ok(
  $$ select * from public.account_deletion_log $$,
  '42501', null, 'account_deletion_log is not readable by clients'
);

-- storage
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/avatar.png') $$,
  '42501', null, 'A cannot upload into B''s avatar folder'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/avatar.png') $$,
  'A can upload into their own avatar folder'
);

-- ---------------------------------------------------------------------------
-- Verify B's data survived A's attempts (as superuser)
-- ---------------------------------------------------------------------------
reset role;

select is(
  (select notes from public.watchlist_items where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'B private note',
  'A''s update did not touch B''s watchlist row'
);

select is(
  (select count(*)::int from public.episode_progress where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'A''s delete did not remove B''s episode progress'
);

select is(
  (select display_name from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  null,
  'A''s update did not touch B''s profile'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitors see nothing
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok($$ select * from public.watchlist_items $$, '42501', null, 'anon cannot read watchlists');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.titles $$, '42501', null, 'anon cannot read the catalog');
select throws_ok($$ select * from public.episode_progress $$, '42501', null, 'anon cannot read episode progress');

reset role;

select * from finish();
rollback;
