import {
  clockOffset,
  realtimeTopicSchema,
  syncEventSchema,
  type SyncEvent,
} from '@bingetrail/shared';

import type { TypedSupabaseClient } from './client-type';
import { queryKeys } from './query-keys';

// Shared by web and mobile (K3): the topic lookup, the event parser and the
// query keys an event affects. Subscriptions themselves are platform-specific.

/** The caller's private Realtime topic, or null if unavailable. */
export async function getRealtimeTopic(client: TypedSupabaseClient): Promise<string | null> {
  const { data, error } = await client.rpc('my_realtime_topic');
  if (error) return null;
  const parsed = realtimeTopicSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Validates a broadcast payload; unknown shapes are ignored, never trusted. */
export function parseSyncEvent(payload: unknown): SyncEvent | null {
  const parsed = syncEventSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Query roots to refresh after a change. Both domains, always: marking an
 * episode also touches the list entry (status, last activity), and list changes
 * move Continue Watching.
 */
export function queryKeysForSyncEvent(event: SyncEvent): ReadonlyArray<readonly unknown[]> {
  return event.table === 'episode_progress'
    ? [queryKeys.progress.all, queryKeys.watchlist.all]
    : [queryKeys.watchlist.all, queryKeys.progress.all];
}

/** Server − device clock difference in ms (for last-write-wins of offline edits). */
export async function measureClockOffset(client: TypedSupabaseClient): Promise<number> {
  const sentAt = Date.now();
  const { data, error } = await client.rpc('server_now');
  const receivedAt = Date.now();
  if (error || typeof data !== 'string') throw new Error('server time unavailable');
  return clockOffset(sentAt, data, receivedAt);
}
