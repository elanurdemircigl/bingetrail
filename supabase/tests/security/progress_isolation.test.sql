-- Episode progress RPCs respect ownership (Faz 5): another user can neither
-- see nor change someone's progress through the functions.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('c5100000-0000-4000-8000-0000000000a1', 'pa@test.local'),
  ('c5100000-0000-4000-8000-0000000000b1', 'pb@test.local');
insert into public.titles (tmdb_id, media_type, original_title) values (996001, 'tv', 'Shared Show');
insert into public.seasons (title_id, season_number, air_date, episode_count)
select id, 1, current_date - 30, 2 from public.titles where tmdb_id = 996001;
insert into public.episodes (season_id, title_id, season_number, episode_number, air_date)
select s.id, s.title_id, 1, g, current_date - 30 + g
from public.seasons s join public.titles t on t.id = s.title_id and t.tmdb_id = 996001
cross join generate_series(1, 2) g;

create temporary table ids on commit drop as
select array_agg(e.id order by e.episode_number) as eps, min(e.title_id) as title_id
from public.episodes e join public.titles t on t.id = e.title_id where t.tmdb_id = 996001;
grant select on ids to authenticated;

-- A watches episode 1.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "c5100000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select public.mark_episodes_watched((select eps[1:1] from ids));

-- B looks and tries to interfere.
select set_config('request.jwt.claims',
  '{"sub": "c5100000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is((select count(*)::integer from public.get_continue_watching()), 0,
  'B has no Continue Watching rows from A');
select results_eq(
  $$ select watched_count from public.get_title_progress((select title_id from ids)) $$,
  $$ values (0) $$, 'B sees only own progress for the shared title');
select is(public.unmark_episodes((select eps from ids)), 0, 'B cannot unmark A''s episodes');
select is((select count(*)::integer from public.episode_progress), 0, 'B cannot read A''s progress rows');

reset role;
select is(
  (select count(*)::integer from public.episode_progress
    where user_id = 'c5100000-0000-4000-8000-0000000000a1'),
  1, 'A''s progress is intact');
select is(
  (select count(*)::integer from public.watchlist_items
    where user_id = 'c5100000-0000-4000-8000-0000000000b1'),
  0, 'B''s calls did not create list entries');

select * from finish();
rollback;
