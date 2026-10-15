-- Realtime change feed for cross-device sync (consumed in Faz 7).
-- postgres_changes respects RLS, so a subscriber only receives its own rows.
alter publication supabase_realtime add table public.watchlist_items, public.episode_progress;
