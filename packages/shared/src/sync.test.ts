import { describe, expect, it } from 'vitest';

import { clockOffset, realtimeTopicSchema, syncEventSchema, toServerTime } from './index';

describe('sync event', () => {
  it('accepts the database payload and rejects anything else', () => {
    expect(syncEventSchema.safeParse({ table: 'episode_progress', titleIds: [7] }).success).toBe(
      true,
    );
    expect(syncEventSchema.safeParse({ table: 'profiles', titleIds: [] }).success).toBe(false);
    expect(syncEventSchema.safeParse({ table: 'watchlist_items' }).success).toBe(false);
  });

  it('only allows well-formed topics', () => {
    expect(realtimeTopicSchema.safeParse(`user:${'a'.repeat(64)}`).success).toBe(true);
    expect(realtimeTopicSchema.safeParse('user:*').success).toBe(false);
    expect(realtimeTopicSchema.safeParse(`realtime:${'a'.repeat(64)}`).success).toBe(false);
  });
});

describe('server time for last-write-wins', () => {
  it('estimates the offset from one round trip', () => {
    // Device sent at 1000 and received at 1200; server said 1100 + 5000 ms.
    expect(clockOffset(1000, new Date(6100).toISOString(), 1200)).toBe(5000);
  });

  it('shifts the action time into server time', () => {
    expect(toServerTime('2026-10-17T10:00:00.000Z', 90_000)).toBe('2026-10-17T10:01:30.000Z');
    expect(toServerTime('2026-10-17T10:00:00.000Z', -500)).toBe('2026-10-17T09:59:59.500Z');
  });
});
