-- Watchlist status/timestamp consistency (Faz 4).
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values ('c3000000-0000-4000-8000-0000000000c3', 'wl@test.local');
insert into public.titles (tmdb_id, media_type, original_title) values
  (994001, 'movie', 'WL One'), (994002, 'movie', 'WL Two'), (994003, 'movie', 'WL Three');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "c3000000-0000-4000-8000-0000000000c3", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.watchlist_items (title_id, status)
     select id, 'planned' from public.titles where tmdb_id = 994001 $$,
  'planned without dates is valid'
);
select lives_ok(
  $$ insert into public.watchlist_items (title_id, status, started_at, completed_at)
     select id, 'completed', now() - interval '2 days', now() from public.titles where tmdb_id = 994002 $$,
  'completed with start and finish dates is valid'
);
select lives_ok(
  $$ insert into public.watchlist_items (title_id, status)
     select id, 'dropped' from public.titles where tmdb_id = 994003 $$,
  'dropping a never-started title is valid'
);

select throws_ok(
  $$ update public.watchlist_items set status = 'watching'
     where title_id = (select id from public.titles where tmdb_id = 994001) $$,
  '23514', null, 'watching requires a start date'
);
select throws_ok(
  $$ update public.watchlist_items set completed_at = now()
     where title_id = (select id from public.titles where tmdb_id = 994001) $$,
  '23514', null, 'a finish date requires the completed status'
);
select throws_ok(
  $$ update public.watchlist_items set status = 'watching'
     where title_id = (select id from public.titles where tmdb_id = 994002) $$,
  '23514', null, 'leaving completed must clear the finish date'
);
select lives_ok(
  $$ update public.watchlist_items set status = 'watching', completed_at = null
     where title_id = (select id from public.titles where tmdb_id = 994002) $$,
  're-watching a completed title (clearing the finish date) is valid'
);
select throws_ok(
  $$ update public.watchlist_items set status = 'completed', started_at = now(), completed_at = now() - interval '1 day'
     where title_id = (select id from public.titles where tmdb_id = 994001) $$,
  '23514', null, 'cannot finish before starting'
);
select lives_ok(
  $$ update public.watchlist_items set status = 'completed', started_at = now() - interval '1 hour', completed_at = now()
     where title_id = (select id from public.titles where tmdb_id = 994001) $$,
  'planned → completed with both dates is valid'
);

reset role;
select * from finish();
rollback;
