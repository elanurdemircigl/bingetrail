-- Rate limiting, maintenance reports and catalog cleanup (Faz 3).
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-00000000000f', 'maint@test.local');

-- ---------------------------------------------------------------------------
-- rate_limit_hit
-- ---------------------------------------------------------------------------
select ok(
  public.rate_limit_hit('f0000000-0000-4000-8000-00000000000f', 'tmdb', 60, 2),
  'first request in a window is allowed'
);
select ok(
  public.rate_limit_hit('f0000000-0000-4000-8000-00000000000f', 'tmdb', 60, 2),
  'second request is still within the limit'
);
select ok(
  not public.rate_limit_hit('f0000000-0000-4000-8000-00000000000f', 'tmdb', 60, 2),
  'third request exceeds the limit'
);
select ok(
  public.rate_limit_hit('f0000000-0000-4000-8000-00000000000f', 'other', 60, 2),
  'buckets are counted independently'
);
select throws_ok(
  $$ select public.rate_limit_hit('f0000000-0000-4000-8000-00000000000f', 'tmdb', 0, 2) $$,
  'P0001', null, 'non-positive window is rejected'
);

-- ---------------------------------------------------------------------------
-- Catalog fixtures: one tracked title, one orphan that is old, one fresh orphan
-- ---------------------------------------------------------------------------
insert into public.titles (tmdb_id, media_type, original_title, last_referenced_at) values
  (993001, 'tv', 'Tracked', now() - interval '200 days'),
  (993002, 'tv', 'Old orphan', now() - interval '200 days'),
  (993003, 'movie', 'Fresh orphan', now());
insert into public.seasons (title_id, season_number)
select id, 1 from public.titles where tmdb_id = 993002;
insert into public.episodes (season_id, title_id, season_number, episode_number)
select s.id, s.title_id, 1, 1 from public.seasons s
join public.titles t on t.id = s.title_id where t.tmdb_id = 993002;
insert into public.watchlist_items (user_id, title_id)
select 'f0000000-0000-4000-8000-00000000000f', id from public.titles where tmdb_id = 993001;

-- ---------------------------------------------------------------------------
-- Stats and cleanup
-- ---------------------------------------------------------------------------
select ok(
  (public.catalog_cache_stats() ->> 'orphan_titles_older_than_threshold')::int >= 1,
  'stats count the old orphan'
);

select is(
  (select count(*)::int from public.titles where tmdb_id in (993001, 993002, 993003)
     and id in (select id from public.titles)),
  3, 'fixtures are in place'
);

select ok(
  public.catalog_cache_cleanup(interval '90 days', true) >= 1,
  'dry run reports at least the old orphan'
);
select is(
  (select count(*)::int from public.titles where tmdb_id = 993002),
  1, 'dry run deletes nothing'
);

select throws_ok(
  $$ select public.catalog_cache_cleanup(interval '7 days', false) $$,
  'P0001', null, 'retention below 30 days is refused'
);

select lives_ok(
  $$ select public.catalog_cache_cleanup(interval '90 days', false) $$,
  'real cleanup runs'
);
select is((select count(*)::int from public.titles where tmdb_id = 993002), 0, 'old orphan was removed');
select is(
  (select count(*)::int from public.episodes e left join public.titles t on t.id = e.title_id where t.id is null),
  0, 'its seasons and episodes cascaded'
);
select is((select count(*)::int from public.titles where tmdb_id = 993001), 1, 'tracked title survives');
select is((select count(*)::int from public.titles where tmdb_id = 993003), 1, 'fresh orphan survives');

-- ---------------------------------------------------------------------------
-- Schedules: report-only jobs exist; the destructive cleanup is NOT scheduled
-- ---------------------------------------------------------------------------
select set_eq(
  $$ select jobname::text from cron.job where jobname in ('purge-rate-limits', 'catalog-cache-report') $$,
  array['purge-rate-limits', 'catalog-cache-report'],
  'operational and report jobs are scheduled'
);
select is_empty(
  $$ select jobname from cron.job where command ilike '%catalog_cache_cleanup%' $$,
  'catalog cleanup is not scheduled (K7)'
);

select * from finish();
rollback;
