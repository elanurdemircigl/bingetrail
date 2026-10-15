-- Row Level Security and privileges (Faz 1).
-- Default is deny: Supabase grants ALL on new public tables to anon/authenticated,
-- so every table is reset to no privileges first, then only what is needed is granted.
-- Policies use (select auth.uid()) so the uid is evaluated once per statement.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.titles enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.episode_progress enable row level security;
alter table public.rate_limits enable row level security;
alter table public.account_deletion_log enable row level security;

-- ---------------------------------------------------------------------------
-- Reset privileges for client roles
-- ---------------------------------------------------------------------------
revoke all on table
  public.profiles,
  public.titles,
  public.seasons,
  public.episodes,
  public.watchlist_items,
  public.episode_progress,
  public.rate_limits,
  public.account_deletion_log
from anon, authenticated;

-- Functions are not callable by clients unless granted explicitly.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles: owner may read and update a fixed set of columns
-- ---------------------------------------------------------------------------
grant select on table public.profiles to authenticated;
grant update (display_name, locale, timezone, avatar_path) on table public.profiles to authenticated;

create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Catalog: read-only for signed-in users; no write policy (service role only)
-- ---------------------------------------------------------------------------
grant select on table public.titles, public.seasons, public.episodes to authenticated;

create policy "titles: signed-in users can read"
  on public.titles for select to authenticated
  using (true);

create policy "seasons: signed-in users can read"
  on public.seasons for select to authenticated
  using (true);

create policy "episodes: signed-in users can read"
  on public.episodes for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- watchlist_items: full ownership, but user_id/title_id/created_at are immutable
-- ---------------------------------------------------------------------------
grant select, delete on table public.watchlist_items to authenticated;
grant insert (title_id, status, rating, notes, started_at, completed_at, last_activity_at)
  on table public.watchlist_items to authenticated;
grant update (status, rating, notes, started_at, completed_at, last_activity_at)
  on table public.watchlist_items to authenticated;

create policy "watchlist_items: owner can read"
  on public.watchlist_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "watchlist_items: owner can insert"
  on public.watchlist_items for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "watchlist_items: owner can update"
  on public.watchlist_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "watchlist_items: owner can delete"
  on public.watchlist_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- episode_progress: insert/delete only (idempotent toggles), no update
-- ---------------------------------------------------------------------------
grant select, delete on table public.episode_progress to authenticated;
grant insert (episode_id, title_id, watched_at) on table public.episode_progress to authenticated;

create policy "episode_progress: owner can read"
  on public.episode_progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "episode_progress: owner can insert"
  on public.episode_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "episode_progress: owner can delete"
  on public.episode_progress for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- rate_limits, account_deletion_log: no grants, no policies.
-- RLS stays enabled as defence in depth; only the service role (which bypasses
-- RLS) may touch them.
-- ---------------------------------------------------------------------------
