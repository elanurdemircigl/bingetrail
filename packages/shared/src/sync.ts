import { z } from 'zod';

/**
 * Cross-device sync signal (Faz 7). The database sends it to the user's private
 * Realtime topic after list/progress changes. It carries no personal data: just
 * which table changed and for which titles; clients re-read with their session.
 */
export const SYNC_EVENT = 'changed';

export const syncEventSchema = z.object({
  table: z.enum(['watchlist_items', 'episode_progress']),
  titleIds: z.array(z.number().int().positive()).max(100),
});
export type SyncEvent = z.infer<typeof syncEventSchema>;

/** Realtime topics are 'user:' + 64 hex chars; anything else is never subscribed. */
export const realtimeTopicSchema = z.string().regex(/^user:[0-9a-f]{64}$/);

/**
 * Device time → server time. Mobile writes its timestamps (status dates, last
 * activity) in server time so a phone with a wrong clock cannot produce dates
 * that contradict other devices. `offsetMs` = server clock − device clock.
 */
export function toServerTime(actionAt: string, offsetMs: number): string {
  return new Date(new Date(actionAt).getTime() + offsetMs).toISOString();
}

/** Server clock offset from one round trip (assumes symmetric latency). */
export function clockOffset(sentAt: number, serverNow: string, receivedAt: number): number {
  return new Date(serverNow).getTime() - (sentAt + receivedAt) / 2;
}
