-- BingeTrail core schema (Faz 1).
-- Catalog tables (titles/seasons/episodes) are a TMDB cache: readable by signed-in
-- users, writable only by Edge Functions using the service role (Faz 3).
-- User tables cascade on auth.users deletion so account deletion leaves no
-- personal data behind (see docs/account-deletion.md).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.media_type as enum ('movie', 'tv');

create type public.watch_status as enum ('planned', 'watching', 'completed', 'paused', 'dropped');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users, created by trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 50),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  timezone text not null default 'Europe/Istanbul' check (char_length(timezone) between 1 and 64),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Per-user settings. Row is created by the on_auth_user_created trigger.';

-- ---------------------------------------------------------------------------
-- Catalog cache (TMDB)
-- ---------------------------------------------------------------------------
create table public.titles (
  id bigint generated always as identity primary key,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type public.media_type not null,
  original_title text not null check (char_length(original_title) between 1 and 500),
  -- Localized name/overview keyed by locale: {"tr": {"title": "...", "overview": "..."}, "en": {...}}
  translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object'),
  poster_path text check (poster_path is null or char_length(poster_path) <= 255),
  backdrop_path text check (backdrop_path is null or char_length(backdrop_path) <= 255),
  release_date date,
  tmdb_status text check (tmdb_status is null or char_length(tmdb_status) <= 50),
  number_of_seasons smallint check (number_of_seasons is null or number_of_seasons >= 0),
  fetched_at timestamptz not null default now(),
  last_referenced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint titles_tmdb_unique unique (tmdb_id, media_type)
);

comment on table public.titles is 'TMDB catalog cache. Written only by Edge Functions (service role).';

create table public.seasons (
  id bigint generated always as identity primary key,
  title_id bigint not null references public.titles (id) on delete cascade,
  tmdb_id integer check (tmdb_id is null or tmdb_id > 0),
  season_number smallint not null check (season_number >= 0),
  -- Localized season name: {"tr": "...", "en": "..."}
  name jsonb not null default '{}'::jsonb check (jsonb_typeof(name) = 'object'),
  air_date date,
  episode_count smallint check (episode_count is null or episode_count >= 0),
  fetched_at timestamptz not null default now(),
  constraint seasons_title_number_unique unique (title_id, season_number),
  -- Lets episodes reference (season, title) together so the pair stays consistent.
  constraint seasons_id_title_unique unique (id, title_id)
);

create table public.episodes (
  id bigint generated always as identity primary key,
  season_id bigint not null,
  title_id bigint not null references public.titles (id) on delete cascade,
  tmdb_id integer check (tmdb_id is null or tmdb_id > 0),
  season_number smallint not null check (season_number >= 0),
  episode_number smallint not null check (episode_number > 0),
  -- Localized episode name: {"tr": "...", "en": "..."}
  name jsonb not null default '{}'::jsonb check (jsonb_typeof(name) = 'object'),
  air_date date,
  runtime smallint check (runtime is null or runtime >= 0),
  fetched_at timestamptz not null default now(),
  constraint episodes_season_fk foreign key (season_id, title_id)
    references public.seasons (id, title_id) on delete cascade,
  constraint episodes_season_number_unique unique (season_id, episode_number),
  -- Lets episode_progress reference (episode, title) together.
  constraint episodes_id_title_unique unique (id, title_id)
);

-- ---------------------------------------------------------------------------
-- User data
-- ---------------------------------------------------------------------------
create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- restrict: a title on anyone's list can never be removed by catalog cleanup.
  title_id bigint not null references public.titles (id) on delete restrict,
  status public.watch_status not null default 'planned',
  rating smallint check (rating is null or rating between 1 and 10),
  notes text check (notes is null or char_length(notes) <= 5000),
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watchlist_items_user_title_unique unique (user_id, title_id)
);

create table public.episode_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  episode_id bigint not null,
  title_id bigint not null,
  watched_at timestamptz not null default now(),
  primary key (user_id, episode_id),
  -- restrict: watched episodes cannot disappear from the catalog underneath a user.
  constraint episode_progress_episode_fk foreign key (episode_id, title_id)
    references public.episodes (id, title_id) on delete restrict
);

-- ---------------------------------------------------------------------------
-- Internal tables (no client access; Edge Functions with service role only)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 64),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, bucket, window_start)
);

comment on table public.rate_limits is 'Per-user request counters for Edge Functions. Service role only.';

create table public.account_deletion_log (
  id bigint generated always as identity primary key,
  -- Salted SHA-256 of the deleted user id; irreversible, holds no personal data.
  user_id_hash text not null check (user_id_hash ~ '^[0-9a-f]{64}$'),
  reason_code text check (reason_code is null or reason_code in ('user_request', 'admin')),
  deleted_at timestamptz not null default now()
);

comment on table public.account_deletion_log is
  'Audit trail of account deletions without personal data. Written by delete-account (service role) only.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index watchlist_items_user_status_idx on public.watchlist_items (user_id, status);
create index watchlist_items_user_activity_idx on public.watchlist_items (user_id, last_activity_at desc);
create index watchlist_items_title_idx on public.watchlist_items (title_id);
create index episode_progress_user_title_idx on public.episode_progress (user_id, title_id);
create index episode_progress_episode_idx on public.episode_progress (episode_id, title_id);
create index episodes_title_air_date_idx on public.episodes (title_id, air_date);
-- Covers the composite episodes_season_fk (season deletes cascade through it).
create index episodes_season_title_idx on public.episodes (season_id, title_id);
create index titles_last_referenced_idx on public.titles (last_referenced_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger titles_set_updated_at
  before update on public.titles
  for each row execute function public.set_updated_at();

create trigger watchlist_items_set_updated_at
  before update on public.watchlist_items
  for each row execute function public.set_updated_at();
