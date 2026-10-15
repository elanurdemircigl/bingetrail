-- Watchlist state consistency (Faz 4). Forward-only; earlier migrations untouched.
-- The app derives the timestamps from status changes (packages/shared
-- applyStatusChange); the database guarantees the result is never contradictory,
-- whichever client writes it.

alter table public.watchlist_items
  -- A finished date only makes sense while the title is marked completed.
  add constraint watchlist_items_completed_at_status
    check (completed_at is null or status = 'completed'),
  -- Watching or completed titles must have a start date.
  add constraint watchlist_items_started_at_status
    check (status not in ('watching', 'completed') or started_at is not null),
  -- Cannot finish before starting.
  add constraint watchlist_items_dates_order
    check (completed_at is null or started_at is null or completed_at >= started_at);

-- List screen: "my list sorted by when I added it".
create index watchlist_items_user_created_idx on public.watchlist_items (user_id, created_at desc);
