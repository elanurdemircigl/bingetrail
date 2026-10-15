-- Catalog support for the tmdb Edge Function (Faz 3): per-user rate limiting,
-- maintenance reporting, and a catalog cleanup that is written but NOT scheduled
-- (K7: activate only after the retention policy and 4+ weeks of reports).
-- All functions here are server-side only: no client role may execute them.

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Called by Edge Functions with the service role.
-- ---------------------------------------------------------------------------
create function public.rate_limit_hit(
  p_user_id uuid,
  p_bucket text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_window_seconds <= 0 or p_max_requests <= 0 then
    raise exception 'rate_limit_hit: window and max must be positive';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (user_id, bucket, window_start, count)
  values (p_user_id, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = r.count + 1
  returning r.count into v_count;

  return v_count <= p_max_requests;
end;
$$;

comment on function public.rate_limit_hit(uuid, text, integer, integer) is
  'Counts one request for (user, bucket) in the current window; true while under the limit.';

-- ---------------------------------------------------------------------------
-- Maintenance reports (service role / cron only)
-- ---------------------------------------------------------------------------
create table public.maintenance_reports (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('catalog_cache_report', 'catalog_cache_cleanup', 'rate_limit_purge')),
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.maintenance_reports enable row level security;
revoke all on table public.maintenance_reports from anon, authenticated;

comment on table public.maintenance_reports is
  'Output of scheduled maintenance jobs. Readable by the service role only.';

-- A catalog title is "referenced" while any user tracks it (watchlist or progress).
create function public.catalog_cache_stats(p_orphan_age interval default interval '90 days')
returns jsonb
language sql
stable
set search_path = ''
as $$
  with refs as (
    select t.id,
           t.fetched_at,
           t.last_referenced_at,
           exists (select 1 from public.watchlist_items w where w.title_id = t.id)
             or exists (select 1 from public.episode_progress p where p.title_id = t.id) as referenced
    from public.titles t
  )
  select jsonb_build_object(
    'total_titles', count(*),
    'referenced_titles', count(*) filter (where referenced),
    'orphan_titles', count(*) filter (where not referenced),
    'orphan_titles_older_than_threshold',
      count(*) filter (where not referenced and last_referenced_at < now() - p_orphan_age),
    'threshold_days', extract(day from p_orphan_age)::int,
    'total_seasons', (select count(*) from public.seasons),
    'total_episodes', (select count(*) from public.episodes),
    'titles_fetched_last_7_days', count(*) filter (where fetched_at > now() - interval '7 days'),
    'oldest_fetched_at', min(fetched_at),
    'generated_at', now()
  )
  from refs;
$$;

create function public.catalog_cache_report()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_report jsonb := public.catalog_cache_stats();
begin
  insert into public.maintenance_reports (kind, report) values ('catalog_cache_report', v_report);
  return v_report;
end;
$$;

-- Deletes unreferenced titles not used for p_older_than. dry_run (default) only
-- counts. Seasons/episodes cascade; watchlist/progress FKs (restrict) make it
-- impossible to delete a title somebody tracks even if this query were wrong.
create function public.catalog_cache_cleanup(
  p_older_than interval default interval '90 days',
  p_dry_run boolean default true
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_older_than < interval '30 days' then
    raise exception 'catalog_cache_cleanup: retention below 30 days is not allowed';
  end if;

  if p_dry_run then
    select count(*) into v_count
    from public.titles t
    where t.last_referenced_at < now() - p_older_than
      and not exists (select 1 from public.watchlist_items w where w.title_id = t.id)
      and not exists (select 1 from public.episode_progress p where p.title_id = t.id);
  else
    with deleted as (
      delete from public.titles t
      where t.last_referenced_at < now() - p_older_than
        and not exists (select 1 from public.watchlist_items w where w.title_id = t.id)
        and not exists (select 1 from public.episode_progress p where p.title_id = t.id)
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;

  insert into public.maintenance_reports (kind, report)
  values (
    'catalog_cache_cleanup',
    jsonb_build_object('dry_run', p_dry_run, 'older_than_days', extract(day from p_older_than)::int, 'titles', v_count)
  );
  return v_count;
end;
$$;

create function public.purge_rate_limits(p_older_than interval default interval '1 day')
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  with deleted as (
    delete from public.rate_limits where window_start < now() - p_older_than returning 1
  )
  select count(*) into v_count from deleted;
  insert into public.maintenance_reports (kind, report)
  values ('rate_limit_purge', jsonb_build_object('rows', v_count));
  return v_count;
end;
$$;

-- No client role may call any of these.
revoke execute on function public.rate_limit_hit(uuid, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.catalog_cache_stats(interval) from public, anon, authenticated;
revoke execute on function public.catalog_cache_report() from public, anon, authenticated;
revoke execute on function public.catalog_cache_cleanup(interval, boolean) from public, anon, authenticated;
revoke execute on function public.purge_rate_limits(interval) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Schedules (pg_cron). Report-only and operational jobs are active; the catalog
-- cleanup is intentionally NOT scheduled (see docs/data-retention.md).
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('purge-rate-limits', '17 3 * * *', $$select public.purge_rate_limits()$$);
select cron.schedule('catalog-cache-report', '23 4 * * 1', $$select public.catalog_cache_report()$$);
