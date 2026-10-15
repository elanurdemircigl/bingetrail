import { describe, expect, it, vi } from 'vitest';

import {
  getRealtimeTopic,
  measureClockOffset,
  parseSyncEvent,
  queryKeys,
  queryKeysForSyncEvent,
  type TypedSupabaseClient,
} from './index';

const TOPIC = `user:${'ab'.repeat(32)}`;

const rpcClient = (result: { data?: unknown; error?: unknown }) =>
  ({
    rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...result }),
  }) as unknown as TypedSupabaseClient;

describe('realtime topic and events', () => {
  it('accepts only well-formed topics from the database', async () => {
    expect(await getRealtimeTopic(rpcClient({ data: TOPIC }))).toBe(TOPIC);
    expect(await getRealtimeTopic(rpcClient({ data: 'user:*' }))).toBeNull();
    expect(await getRealtimeTopic(rpcClient({ error: { code: '42501' } }))).toBeNull();
  });

  it('ignores unexpected payloads', () => {
    expect(parseSyncEvent({ table: 'episode_progress', titleIds: [7], id: 'x' })).toEqual({
      table: 'episode_progress',
      titleIds: [7],
    });
    expect(parseSyncEvent({ table: 'auth.users' })).toBeNull();
    expect(parseSyncEvent('refresh')).toBeNull();
  });

  it('refreshes list and progress for either table', () => {
    for (const table of ['episode_progress', 'watchlist_items'] as const) {
      expect(queryKeysForSyncEvent({ table, titleIds: [] })).toEqual(
        expect.arrayContaining([queryKeys.progress.all, queryKeys.watchlist.all]),
      );
    }
  });

  it('measures the server clock offset', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(1_200);
    const offset = await measureClockOffset(rpcClient({ data: new Date(6_100).toISOString() }));
    expect(offset).toBe(5_000);
    now.mockRestore();
  });
});
