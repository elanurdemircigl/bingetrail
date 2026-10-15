-- Episode tracking RPCs and Continue Watching (Faz 5).
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email) values ('c5000000-0000-4000-8000-0000000000a5', 'ep@test.local');

-- Series 995001: specials (S0E1), S1 = 3 aired + 1 future, S2 = 2 aired.
-- Series 995002: one season with 150 aired episodes. Series 995003: season not cached.
insert into public.titles (tmdb_id, media_type, original_title) values
  (995001, 'tv', 'Progress Show'), (995002, 'tv', 'Long Show'), (995003, 'tv', 'Uncached Show');

insert into public.seasons (title_id, season_number, air_date, episode_count)
select t.id, s.n, current_date - 400, s.c
from public.titles t
cross join (values (0, 1), (1, 4), (2, 2)) as s(n, c)
where t.tmdb_id = 995001;
insert into public.seasons (title_id, season_number, air_date, episode_count)
select id, 1, current_date - 300, 150 from public.titles where tmdb_id = 995002;
insert into public.seasons (title_id, season_number, air_date, episode_count)
select id, 1, current_date - 300, 5 from public.titles where tmdb_id = 995003;

insert into public.episodes (season_id, title_id, season_number, episode_number, air_date)
select s.id, s.title_id, s.season_number, e.n, e.d
from public.seasons s
join public.titles t on t.id = s.title_id and t.tmdb_id = 995001
join (values
  (0, 1, current_date - 390),
  (1, 1, current_date - 380), (1, 2, current_date - 370), (1, 3, current_date - 360),
  (1, 4, current_date + 30),
  (2, 1, current_date - 100), (2, 2, current_date - 90)
) as e(season, n, d) on e.season = s.season_number;

insert into public.episodes (season_id, title_id, season_number, episode_number, air_date)
select s.id, s.title_id, 1, g, current_date - 300 + g
from public.seasons s
join public.titles t on t.id = s.title_id and t.tmdb_id = 995002
cross join generate_series(1, 150) as g;

create temporary table ep on commit drop as
select e.id, e.season_number as s, e.episode_number as n, t.tmdb_id
from public.episodes e join public.titles t on t.id = e.title_id
where t.tmdb_id in (995001, 995002);
grant select on ep to authenticated;

create function pg_temp.ep_id(p_tmdb integer, p_s integer, p_n integer) returns bigint
language sql stable as $$ select id from ep where tmdb_id = p_tmdb and s = p_s and n = p_n $$;
create function pg_temp.title(p_tmdb integer) returns bigint
language sql stable as $$ select id from public.titles where tmdb_id = p_tmdb $$;
grant execute on function pg_temp.ep_id(integer, integer, integer), pg_temp.title(integer) to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "c5000000-0000-4000-8000-0000000000a5", "role": "authenticated"}', true);

-- Marking ------------------------------------------------------------------
select is(public.mark_episodes_watched(array[pg_temp.ep_id(995001, 1, 1)]), 1, 'marks one episode');
select is(public.mark_episodes_watched(array[pg_temp.ep_id(995001, 1, 1)]), 0, 'marking again is idempotent');
select is(
  (select status::text || ',' || (started_at is not null)::text from public.watchlist_items
    where title_id = pg_temp.title(995001)),
  'watching,true',
  'the first watched episode puts the title on the list as watching'
);

select throws_ok(
  format('select public.mark_episodes_watched(array[%s])', pg_temp.ep_id(995001, 1, 4)),
  '22023', 'episode_not_aired', 'an unaired episode cannot be marked'
);
select throws_ok(
  format('insert into public.episode_progress (episode_id, title_id) values (%s, %s)',
    pg_temp.ep_id(995001, 1, 4), pg_temp.title(995001)),
  '22023', 'episode_not_aired', 'the guard also blocks direct inserts of unaired episodes'
);
select throws_ok(
  'select public.mark_episodes_watched(array[-1::bigint])',
  '22023', 'episode_not_found', 'unknown episode ids are rejected'
);
select throws_ok(
  'select public.mark_episodes_watched(array(select g::bigint from generate_series(1, 2001) g))',
  '22023', 'too_many_episodes', 'more than 2000 ids per call are rejected'
);
select throws_ok(
  'select public.mark_episodes_watched(array[]::bigint[])',
  '22023', 'invalid_episodes', 'an empty list is rejected'
);
select throws_ok(
  format('select public.mark_episodes_watched(array[%s, null])', pg_temp.ep_id(995001, 1, 2)),
  '22023', 'invalid_episodes', 'null ids are rejected'
);
select is(
  (select count(*)::integer from public.episode_progress where title_id = pg_temp.title(995001)),
  1,
  'rejected calls changed nothing'
);

-- Continue watching ----------------------------------------------------------
select is(
  (select next_episode_id from public.get_continue_watching() where title_id = pg_temp.title(995001)),
  pg_temp.ep_id(995001, 1, 2),
  'next episode follows the last watched one'
);

-- Watch S1E2 and S2E1 (skipping S1E3): next is after the furthest one.
select is(
  public.mark_episodes_watched(array[pg_temp.ep_id(995001, 1, 2), pg_temp.ep_id(995001, 2, 1)]),
  2, 'marks several episodes in one call'
);
select results_eq(
  $$ select next_season_number::integer, next_episode_number::integer, watched_count, aired_count
     from public.get_continue_watching() where title_id = pg_temp.title(995001) $$,
  $$ values (2, 2, 3, 5) $$,
  'next is S2E2; counts cover aired regular episodes only'
);

-- Specials can be marked but never count or appear as "next".
select is(public.mark_episodes_watched(array[pg_temp.ep_id(995001, 0, 1)]), 1, 'specials can be marked');
select is(
  (select watched_count from public.get_continue_watching() where title_id = pg_temp.title(995001)),
  3, 'specials are not counted'
);

select results_eq(
  $$ select aired_count, watched_count, catalog_complete
     from public.get_title_progress(pg_temp.title(995001)) $$,
  $$ values (5, 3, true) $$,
  'title progress: aired, watched, fully cached'
);
select is(
  (select catalog_complete from public.get_title_progress(pg_temp.title(995003))),
  false, 'a season without cached episodes makes the progress incomplete'
);

-- Unmarking moves "next" back.
select is(public.unmark_episodes(array[pg_temp.ep_id(995001, 2, 1)]), 1, 'unmarks an episode');
select is(
  (select next_episode_id from public.get_continue_watching() where title_id = pg_temp.title(995001)),
  pg_temp.ep_id(995001, 1, 3),
  'after unmarking, next is again after the furthest watched episode'
);

-- Statuses other than planned/watching are left alone; only watching is listed.
update public.watchlist_items set status = 'paused' where title_id = pg_temp.title(995001);
select public.mark_episodes_watched(array[pg_temp.ep_id(995001, 1, 3)]);
select is(
  (select status::text from public.watchlist_items where title_id = pg_temp.title(995001)),
  'paused', 'marking does not override a paused status'
);
select is(
  (select count(*)::integer from public.get_continue_watching() where title_id = pg_temp.title(995001)),
  0, 'paused titles are not in Continue Watching'
);

-- Bulk: 150 episodes in a single call; planned → watching.
insert into public.watchlist_items (title_id, status) values (pg_temp.title(995002), 'planned');
select is(
  public.mark_episodes_watched(array(select id from ep where tmdb_id = 995002)),
  150, '150 episodes are marked in one request'
);
select results_eq(
  $$ select w.status::text, (w.started_at is not null), p.aired_count, p.watched_count, p.catalog_complete
     from public.watchlist_items w, public.get_title_progress(w.title_id) p
     where w.title_id = pg_temp.title(995002) $$,
  $$ values ('watching'::text, true, 150, 150, true) $$,
  'planned became watching and every aired episode is watched'
);
select is(
  (select next_episode_id from public.get_continue_watching() where title_id = pg_temp.title(995002)),
  null::bigint, 'nothing left to watch means no next episode'
);

reset role;

-- Privileges ---------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.mark_episodes_watched(bigint[])', 'execute')
  and not has_function_privilege('anon', 'public.get_continue_watching(integer)', 'execute'),
  'anonymous callers cannot use the progress functions'
);
select ok(
  not exists (
    select 1 from pg_proc
    where proname in ('mark_episodes_watched', 'unmark_episodes', 'get_continue_watching',
                      'get_title_progress', 'episode_progress_guard', 'catalog_today')
      and (prosecdef or proconfig is null)
  ),
  'progress functions are SECURITY INVOKER with a fixed search_path'
);

select * from finish();
rollback;
