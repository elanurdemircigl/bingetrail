-- Cross-device sync signals (Faz 7). Forward-only; earlier migrations untouched.
--
-- Design (docs/sync.md, ADR-0007): the web app keeps sessions in HttpOnly
-- cookies and never gives the browser a token, so it cannot join an RLS-checked
-- Realtime channel. Instead, every change to a user's list or progress sends a
-- data-free "changed" signal to a PUBLIC broadcast topic that only that user can
-- know: 'user:' || HMAC-SHA256(user id, server-side secret). Clients re-read
-- their data with their own session (RLS) when the signal arrives.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- One random secret, generated in the database; it never leaves it.
create table private.realtime_secret (
  id boolean primary key default true check (id),
  secret bytea not null check (octet_length(secret) >= 32)
);
alter table private.realtime_secret enable row level security;
revoke all on table private.realtime_secret from public, anon, authenticated;
insert into private.realtime_secret (secret) values (extensions.gen_random_bytes(32));

create or replace function private.realtime_topic(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'user:' || encode(extensions.hmac(convert_to(p_user_id::text, 'UTF8'), s.secret, 'sha256'), 'hex')
  from private.realtime_secret s
$$;

-- The caller's own topic (from the JWT subject; no argument to tamper with).
create or replace function public.my_realtime_topic()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.realtime_topic((select auth.uid()))
  where (select auth.uid()) is not null
$$;

comment on function public.my_realtime_topic() is
  'Unguessable Realtime broadcast topic of the caller; signals carry no personal data.';

-- Statement-level: a 120-episode bulk mark sends ONE signal, not 120.
-- Runs as owner: clients have no access to private.* or realtime.messages.
create or replace function private.notify_user_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select c.user_id, array_agg(distinct c.title_id order by c.title_id) as title_ids
    from changed_rows c
    group by c.user_id
  loop
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'titleIds', to_jsonb(r.title_ids[1:100])),
      'changed',
      private.realtime_topic(r.user_id),
      false
    );
  end loop;
  return null;
end;
$$;

-- Transition tables allow one event per trigger, hence three per table.
create trigger watchlist_items_sync_insert after insert on public.watchlist_items
  referencing new table as changed_rows
  for each statement execute function private.notify_user_changes();
create trigger watchlist_items_sync_update after update on public.watchlist_items
  referencing new table as changed_rows
  for each statement execute function private.notify_user_changes();
create trigger watchlist_items_sync_delete after delete on public.watchlist_items
  referencing old table as changed_rows
  for each statement execute function private.notify_user_changes();

create trigger episode_progress_sync_insert after insert on public.episode_progress
  referencing new table as changed_rows
  for each statement execute function private.notify_user_changes();
create trigger episode_progress_sync_delete after delete on public.episode_progress
  referencing old table as changed_rows
  for each statement execute function private.notify_user_changes();

-- Server clock for conflict resolution: offline edits are compared in server
-- time (client clocks drift), see docs/sync.md.
create or replace function public.server_now()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke execute on function private.realtime_topic(uuid) from public, anon, authenticated;
revoke execute on function private.notify_user_changes() from public, anon, authenticated;
revoke execute on function public.my_realtime_topic() from public, anon;
revoke execute on function public.server_now() from public, anon;
grant execute on function public.my_realtime_topic() to authenticated;
grant execute on function public.server_now() to authenticated;
