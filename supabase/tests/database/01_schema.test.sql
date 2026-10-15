-- Schema invariants, constraints and catalog integrity (Faz 1).
-- Runs as the test superuser; RLS behaviour lives in supabase/tests/security.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- ---------------------------------------------------------------------------
-- Objects exist
-- ---------------------------------------------------------------------------
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'titles', 'titles table exists');
select has_table('public', 'seasons', 'seasons table exists');
select has_table('public', 'episodes', 'episodes table exists');
select has_table('public', 'watchlist_items', 'watchlist_items table exists');
select has_table('public', 'episode_progress', 'episode_progress table exists');
select has_table('public', 'rate_limits', 'rate_limits table exists');
select has_table('public', 'account_deletion_log', 'account_deletion_log table exists');

select enum_has_labels('public', 'media_type', array['movie', 'tv'], 'media_type enum labels');
select enum_has_labels(
  'public', 'watch_status',
  array['planned', 'watching', 'completed', 'paused', 'dropped'],
  'watch_status enum labels'
);

-- ---------------------------------------------------------------------------
-- Global security invariants (catalog queries, so new tables are covered too)
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'RLS is enabled on every public table'
);

select is_empty(
  $$ select col.table_name::text
     from information_schema.columns col
     where col.table_schema = 'public' and col.column_name = 'user_id'
       and not exists (
         select 1
         from pg_constraint k
         join pg_class t on t.oid = k.conrelid
         join pg_namespace n on n.oid = t.relnamespace
         join pg_attribute a on a.attrelid = t.oid and a.attname = 'user_id'
         where n.nspname = 'public' and t.relname = col.table_name
           and k.contype = 'f' and k.confrelid = 'auth.users'::regclass
           and k.confdeltype = 'c' and k.conkey = array[a.attnum]
       ) $$,
  'every user_id column has an ON DELETE CASCADE foreign key to auth.users'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass and confdeltype = 'c'
  ),
  'profiles.id cascades from auth.users'
);

select is_empty(
  $$ select p.proname::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%') $$,
  'every SECURITY DEFINER function in public pins search_path'
);

select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and not coalesce(c.reloptions @> array['security_invoker=true'], false) $$,
  'every view in public uses security_invoker'
);

select is(
  (select public from storage.buckets where id = 'avatars'),
  false,
  'avatars bucket is private'
);

select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['watchlist_items', 'episode_progress'],
  'realtime publishes exactly watchlist_items and episode_progress'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'schema-a@test.local', '{}'),
  ('c0000000-0000-4000-8000-00000000000c', 'schema-c@test.local', '{"locale": "en"}'),
  ('d0000000-0000-4000-8000-00000000000d', 'schema-d@test.local', '{"locale": "de"}');

insert into public.titles (tmdb_id, media_type, original_title)
values (990001, 'tv', 'Schema Test Show'), (990002, 'tv', 'Other Show'), (990003, 'movie', 'Lonely Movie');

insert into public.seasons (title_id, season_number)
select id, 1 from public.titles where tmdb_id in (990001, 990002, 990003);

insert into public.episodes (season_id, title_id, season_number, episode_number)
select s.id, s.title_id, 1, 1 from public.seasons s
join public.titles t on t.id = s.title_id where t.tmdb_id in (990001, 990002, 990003);

-- ---------------------------------------------------------------------------
-- Profile trigger
-- ---------------------------------------------------------------------------
select is(
  (select locale from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a'),
  'tr',
  'signup creates a profile with the default locale'
);

select is(
  (select locale from public.profiles where id = 'c0000000-0000-4000-8000-00000000000c'),
  'en',
  'signup honours a supported locale from user metadata'
);

select is(
  (select locale from public.profiles where id = 'd0000000-0000-4000-8000-00000000000d'),
  'tr',
  'signup falls back to tr for an unsupported locale'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.watchlist_items (user_id, title_id, rating)
     select 'a0000000-0000-4000-8000-00000000000a', id, 11 from public.titles where tmdb_id = 990001 $$,
  '23514', null, 'rating above 10 is rejected'
);

select throws_ok(
  $$ insert into public.watchlist_items (user_id, title_id, rating)
     select 'a0000000-0000-4000-8000-00000000000a', id, 0 from public.titles where tmdb_id = 990001 $$,
  '23514', null, 'rating below 1 is rejected'
);

select throws_ok(
  $$ insert into public.watchlist_items (user_id, title_id, notes)
     select 'a0000000-0000-4000-8000-00000000000a', id, repeat('x', 5001) from public.titles where tmdb_id = 990001 $$,
  '23514', null, 'notes longer than 5000 characters are rejected'
);

select lives_ok(
  $$ insert into public.watchlist_items (user_id, title_id, rating, notes)
     select 'a0000000-0000-4000-8000-00000000000a', id, 10, repeat('x', 5000) from public.titles where tmdb_id = 990001 $$,
  'boundary rating and note length are accepted'
);

select throws_ok(
  $$ insert into public.watchlist_items (user_id, title_id)
     select 'a0000000-0000-4000-8000-00000000000a', id from public.titles where tmdb_id = 990001 $$,
  '23505', null, 'the same title cannot be added twice by one user'
);

select throws_ok(
  $$ insert into public.titles (tmdb_id, media_type, original_title) values (990001, 'tv', 'Duplicate') $$,
  '23505', null, 'tmdb_id + media_type is unique in the catalog'
);

select throws_ok(
  $$ insert into public.episodes (season_id, title_id, season_number, episode_number)
     select s.id, (select id from public.titles where tmdb_id = 990002), 1, 2
     from public.seasons s join public.titles t on t.id = s.title_id where t.tmdb_id = 990001 $$,
  '23503', null, 'an episode cannot point at a season of a different title'
);

select throws_ok(
  $$ insert into public.episode_progress (user_id, episode_id, title_id)
     select 'a0000000-0000-4000-8000-00000000000a', e.id, (select id from public.titles where tmdb_id = 990002)
     from public.episodes e join public.titles t on t.id = e.title_id where t.tmdb_id = 990001 $$,
  '23503', null, 'episode progress must use the episode''s own title'
);

-- ---------------------------------------------------------------------------
-- Catalog cleanup safety
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ delete from public.titles where tmdb_id = 990001 $$,
  '23503', null, 'a title on a watchlist cannot be deleted from the catalog'
);

delete from public.titles where tmdb_id = 990003;

select is(
  (select count(*)::int from public.episodes e
   left join public.titles t on t.id = e.title_id where t.id is null),
  0,
  'deleting an unreferenced title cascades to its seasons and episodes'
);

select * from finish();
rollback;
