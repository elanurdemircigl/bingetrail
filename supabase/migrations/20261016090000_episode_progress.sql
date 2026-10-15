-- Episode tracking and Continue Watching (Faz 5). Forward-only; earlier
-- migrations untouched. Every function is SECURITY INVOKER with an empty
-- search_path: callers act with their own privileges and RLS applies.

-- "Today" for air dates. TMDB dates are calendar dates; UTC until per-user
-- time zones arrive with the calendar (Faz 8).
create or replace function public.catalog_today()
returns date
language sql
stable
security invoker
set search_path = ''
as $$ select (now() at time zone 'utc')::date $$;

-- Episode order lookups (next episode, season lists); air_date included so the
-- aired-episode counts can be answered from the index alone.
create index episodes_title_order_idx
  on public.episodes (title_id, season_number, episode_number) include (air_date);

-- ---------------------------------------------------------------------------
-- Unaired episodes can never be marked, whichever way the row is written.
-- ---------------------------------------------------------------------------
create or replace function public.episode_progress_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_air_date date;
begin
  select e.air_date into v_air_date from public.episodes e where e.id = new.episode_id;
  if v_air_date is null or v_air_date > public.catalog_today() then
    raise exception 'episode_not_aired' using errcode = '22023';
  end if;
  -- A watch cannot happen in the future.
  new.watched_at := least(new.watched_at, now());
  return new;
end;
$$;

create trigger episode_progress_guard
  before insert on public.episode_progress
  for each row execute function public.episode_progress_guard();

-- ---------------------------------------------------------------------------
-- mark_episodes_watched: one request for any number of episodes (≤ 2000)
-- ---------------------------------------------------------------------------
create or replace function public.mark_episodes_watched(p_episode_ids bigint[])
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_now timestamptz := now();
  v_ids bigint[];
  v_inserted integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_episode_ids is null or cardinality(p_episode_ids) = 0
     or array_position(p_episode_ids, null) is not null then
    raise exception 'invalid_episodes' using errcode = '22023';
  end if;
  -- Bounded work per call (DoS guard); the longest real series fit easily.
  if cardinality(p_episode_ids) > 2000 then
    raise exception 'too_many_episodes' using errcode = '22023';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_episode_ids) as x;

  if (select count(*) from public.episodes e where e.id = any (v_ids)) <> cardinality(v_ids) then
    raise exception 'episode_not_found' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.episodes e
    where e.id = any (v_ids)
      and (e.air_date is null or e.air_date > public.catalog_today())
  ) then
    raise exception 'episode_not_aired' using errcode = '22023';
  end if;

  with inserted as (
    insert into public.episode_progress (episode_id, title_id, watched_at)
    select e.id, e.title_id, v_now from public.episodes e where e.id = any (v_ids)
    on conflict (user_id, episode_id) do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  -- Watching a title puts it on the list: new titles start as "watching",
  -- planned ones move to "watching". Other statuses are the user's choice and
  -- stay as they are; completion is only ever suggested, never automatic.
  insert into public.watchlist_items as w (title_id, status, started_at, last_activity_at)
  select distinct e.title_id, 'watching'::public.watch_status, v_now, v_now
  from public.episodes e
  where e.id = any (v_ids)
  on conflict (user_id, title_id) do update
    set last_activity_at = excluded.last_activity_at,
        status = case when w.status = 'planned' then 'watching'::public.watch_status else w.status end,
        started_at = case when w.status = 'planned' then coalesce(w.started_at, excluded.started_at)
                          else w.started_at end;

  return v_inserted;
end;
$$;

comment on function public.mark_episodes_watched(bigint[]) is
  'Marks the caller''s episodes as watched (aired only, ≤ 2000 per call) and updates the list entry. Returns newly marked count.';

-- ---------------------------------------------------------------------------
-- unmark_episodes
-- ---------------------------------------------------------------------------
create or replace function public.unmark_episodes(p_episode_ids bigint[])
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_episode_ids is null or cardinality(p_episode_ids) = 0
     or array_position(p_episode_ids, null) is not null then
    raise exception 'invalid_episodes' using errcode = '22023';
  end if;
  if cardinality(p_episode_ids) > 2000 then
    raise exception 'too_many_episodes' using errcode = '22023';
  end if;

  with deleted as (
    delete from public.episode_progress p
    where p.user_id = v_user and p.episode_id = any (p_episode_ids)
    returning p.title_id
  ), touched as (
    update public.watchlist_items w
    set last_activity_at = now()
    where w.user_id = v_user and w.title_id in (select distinct d.title_id from deleted d)
    returning 1
  )
  select count(*) into v_deleted from deleted;

  return v_deleted;
end;
$$;

comment on function public.unmark_episodes(bigint[]) is
  'Removes the caller''s watched marks (≤ 2000 per call). Returns removed count.';

-- ---------------------------------------------------------------------------
-- get_continue_watching: one query for the home screen (no N+1)
-- ---------------------------------------------------------------------------
create or replace function public.get_continue_watching(p_limit integer default 20)
returns table (
  item_id uuid,
  title_id bigint,
  tmdb_id integer,
  media_type public.media_type,
  original_title text,
  translations jsonb,
  poster_path text,
  last_activity_at timestamptz,
  next_episode_id bigint,
  next_season_number smallint,
  next_episode_number smallint,
  next_episode_name jsonb,
  next_air_date date,
  watched_count integer,
  aired_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Index-friendly by design (measured: 20 of 30 series × 1000 episodes in a
  -- few ms): "today" is computed once, "next" walks episodes_title_order_idx
  -- and stops at the first match, and the counts never join all episodes.
  with today as materialized (select public.catalog_today() as d)
  select
    w.id, t.id, t.tmdb_id, t.media_type, t.original_title, t.translations, t.poster_path,
    w.last_activity_at,
    n.id, n.season_number, n.episode_number, n.name, n.air_date,
    (select count(*) from public.episode_progress p
      join public.episodes e on e.id = p.episode_id
      where p.user_id = w.user_id and p.title_id = w.title_id
        and e.season_number > 0 and e.air_date <= today.d)::integer,
    (select count(*) from public.episodes e
      where e.title_id = w.title_id and e.season_number > 0
        and e.air_date <= today.d)::integer
  from public.watchlist_items w
  cross join today
  join public.titles t on t.id = w.title_id
  -- Furthest watched regular episode (specials, season 0, are ignored).
  left join lateral (
    select e.season_number, e.episode_number
    from public.episode_progress p
    join public.episodes e on e.id = p.episode_id
    where p.user_id = w.user_id and p.title_id = w.title_id and e.season_number > 0
    order by e.season_number desc, e.episode_number desc
    limit 1
  ) last_watched on true
  -- Next: the first aired, unwatched regular episode after it (or the very first one).
  left join lateral (
    select e.id, e.season_number, e.episode_number, e.name, e.air_date
    from public.episodes e
    where e.title_id = w.title_id
      and (e.season_number, e.episode_number)
          > (coalesce(last_watched.season_number, 0), coalesce(last_watched.episode_number, 0))
      and e.season_number > 0
      and e.air_date <= today.d
      and not exists (
        select 1 from public.episode_progress p
        where p.user_id = w.user_id and p.episode_id = e.id
      )
    order by e.season_number, e.episode_number
    limit 1
  ) n on true
  where w.user_id = (select auth.uid())
    and w.status = 'watching'
  order by w.last_activity_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function public.get_continue_watching(integer) is
  'The caller''s "watching" titles by recent activity, each with its next aired unwatched episode.';

-- ---------------------------------------------------------------------------
-- get_title_progress: aired vs watched for one title (completion suggestion)
-- ---------------------------------------------------------------------------
create or replace function public.get_title_progress(p_title_id bigint)
returns table (aired_count integer, watched_count integer, catalog_complete boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as materialized (select public.catalog_today() as d)
  select
    (select count(*) from public.episodes e
      where e.title_id = p_title_id and e.season_number > 0
        and e.air_date <= today.d)::integer,
    (select count(*) from public.episode_progress p
      join public.episodes e on e.id = p.episode_id
      where p.user_id = (select auth.uid()) and p.title_id = p_title_id
        and e.season_number > 0 and e.air_date <= today.d)::integer,
    -- Seasons are cached on demand: only claim "all watched" when every aired
    -- regular season has its episodes in the cache.
    not exists (
      select 1 from public.seasons s
      where s.title_id = p_title_id
        and s.season_number > 0
        and s.air_date <= today.d
        and (select count(*) from public.episodes e where e.season_id = s.id)
            < coalesce(s.episode_count, 1)
    )
  from today;
$$;

comment on function public.get_title_progress(bigint) is
  'Aired and watched regular episodes of a title for the caller, and whether all aired seasons are cached.';

-- ---------------------------------------------------------------------------
-- Privileges: signed-in users only
-- ---------------------------------------------------------------------------
revoke execute on function public.catalog_today() from public, anon;
revoke execute on function public.episode_progress_guard() from public, anon, authenticated;
revoke execute on function public.mark_episodes_watched(bigint[]) from public, anon;
revoke execute on function public.unmark_episodes(bigint[]) from public, anon;
revoke execute on function public.get_continue_watching(integer) from public, anon;
revoke execute on function public.get_title_progress(bigint) from public, anon;

grant execute on function public.catalog_today() to authenticated;
grant execute on function public.mark_episodes_watched(bigint[]) to authenticated;
grant execute on function public.unmark_episodes(bigint[]) to authenticated;
grant execute on function public.get_continue_watching(integer) to authenticated;
grant execute on function public.get_title_progress(bigint) to authenticated;
