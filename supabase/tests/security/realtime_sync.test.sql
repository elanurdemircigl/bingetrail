-- Sync signals (Faz 7): topics are per-user, unguessable and unreachable for
-- other users; signals carry no personal data; one signal per statement.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('c7000000-0000-4000-8000-0000000000a7', 'sa@test.local'),
  ('c7000000-0000-4000-8000-0000000000b7', 'sb@test.local');
insert into public.titles (tmdb_id, media_type, original_title) values (997701, 'tv', 'Sync Show');
insert into public.seasons (title_id, season_number, air_date, episode_count)
select id, 1, current_date - 10, 3 from public.titles where tmdb_id = 997701;
insert into public.episodes (season_id, title_id, season_number, episode_number, air_date)
select s.id, s.title_id, 1, g, current_date - 10 from public.seasons s
join public.titles t on t.id = s.title_id and t.tmdb_id = 997701, generate_series(1, 3) g;

create temporary table ctx on commit drop as
select
  private.realtime_topic('c7000000-0000-4000-8000-0000000000a7') as topic_a,
  private.realtime_topic('c7000000-0000-4000-8000-0000000000b7') as topic_b,
  (select array_agg(e.id order by e.episode_number) from public.episodes e
    join public.titles t on t.id = e.title_id where t.tmdb_id = 997701) as eps;
grant select on ctx to authenticated;

select matches((select topic_a from ctx), '^user:[0-9a-f]{64}$', 'topics are user: + 64 hex chars');
select isnt((select topic_a from ctx), (select topic_b from ctx), 'each user has a different topic');
select ok(
  (select position(replace('c7000000-0000-4000-8000-0000000000a7', '-', '') in topic_a) = 0 from ctx),
  'the topic does not contain the user id'
);

-- Client roles: own topic only; no access to the secret or the generator.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "c7000000-0000-4000-8000-0000000000a7", "role": "authenticated"}', true);
select is(public.my_realtime_topic(), (select topic_a from ctx), 'a user gets exactly their own topic');
select throws_ok('select secret from private.realtime_secret', '42501', null,
  'clients cannot read the secret');
select throws_ok(
  $$ select private.realtime_topic('c7000000-0000-4000-8000-0000000000b7') $$,
  '42501', null, 'clients cannot compute another user''s topic');
select isnt(public.server_now(), null, 'server time is available to signed-in users');

-- One signal per statement, with table + title ids only.
select public.mark_episodes_watched((select eps from ctx));
reset role;

select is(
  (select count(*)::integer from realtime.messages where topic = (select topic_a from ctx)
     and payload->>'table' = 'episode_progress'),
  1, 'marking 3 episodes sends a single progress signal'
);
select is(
  (select count(*)::integer from realtime.messages where topic = (select topic_b from ctx)),
  0, 'nothing is sent to other users'
);
select ok(
  (select bool_and(not (payload ? 'notes') and not (payload ? 'rating') and not (payload ? 'user_id')
     and private = false and event = 'changed')
   from realtime.messages where topic = (select topic_a from ctx)),
  'signals carry no personal data'
);

set local role anon;
select throws_ok('select public.my_realtime_topic()', '42501', null, 'anonymous callers get no topic');
reset role;

select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname in ('realtime_topic', 'my_realtime_topic', 'notify_user_changes', 'server_now')
      and p.proconfig is null
  ),
  'sync functions pin their search_path'
);

select * from finish();
rollback;
