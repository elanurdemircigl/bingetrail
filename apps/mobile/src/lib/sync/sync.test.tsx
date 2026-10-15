import {
  dehydrate,
  hydrate,
  MutationObserver,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { queryKeys } from '@bingetrail/api-client';

import { createQueryClient, MUTATION_KEYS, registerMutationDefaults } from '../queries';

import { LiveSyncProvider } from './live-sync';
import { shouldPersistQuery } from './persist';

// --- backend doubles ---------------------------------------------------------
const mockCalls: string[] = [];
let mockBroadcast: ((msg: { payload: unknown }) => void) | null = null;
let mockStatus: ((s: string) => void) | null = null;
const mockRemoveChannel = jest.fn();

jest.mock('@/lib/sync/clock', () => ({
  serverNowIso: async () => '2026-10-17T10:00:00.000Z',
  refreshClockOffset: async () => 0,
}));

jest.mock('@/lib/supabase/client', () => {
  const channel = {
    on: (_type: string, _filter: unknown, cb: (msg: { payload: unknown }) => void) => {
      mockBroadcast = cb;
      return channel;
    },
    subscribe: (cb: (s: string) => void) => {
      mockStatus = cb;
      return channel;
    },
  };
  return {
    supabase: {
      channel: jest.fn(() => channel),
      removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
      auth: {
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      },
    },
  };
});

jest.mock('@bingetrail/api-client', () => {
  const actual = jest.requireActual('@bingetrail/api-client');
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      mockCalls.push(`${name}:${JSON.stringify(args.slice(1))}`);
    };
  return {
    ...actual,
    getRealtimeTopic: async () => `user:${'ab'.repeat(32)}`,
    updateWatchlistStatus: record('status'),
    updateWatchlistDetails: record('details'),
    markEpisodesWatched: async (_c: unknown, ids: number[]) => {
      mockCalls.push(`mark:${ids.join(',')}`);
      return ids.length;
    },
    unmarkEpisodes: async (_c: unknown, ids: number[]) => {
      mockCalls.push(`unmark:${ids.join(',')}`);
      return ids.length;
    },
    addToWatchlist: async () => {
      mockCalls.push('add');
      throw new actual.WatchlistError('already_exists');
    },
    removeFromWatchlist: async () => {
      mockCalls.push('remove');
      throw new actual.WatchlistError('not_found');
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockBroadcast = null;
  mockStatus = null;
  mockRemoveChannel.mockClear();
});
afterEach(() => onlineManager.setOnline(true));

const queue = (client: QueryClient, key: readonly unknown[], vars: unknown) => {
  void new MutationObserver<unknown, Error, unknown>(client, { mutationKey: key })
    .mutate(vars)
    .catch(() => undefined);
};

describe('offline queue', () => {
  it('keeps 10 offline changes across a restart and applies all of them in order', async () => {
    onlineManager.setOnline(false);
    const before = createQueryClient();
    for (let i = 1; i <= 10; i++) {
      if (i % 2) queue(before, MUTATION_KEYS.episodes, { titleId: 7, ids: [i], watched: true });
      else queue(before, MUTATION_KEYS.status, { itemId: `item-${i}`, status: 'watching' });
    }
    await act(async () => undefined);
    expect(mockCalls).toEqual([]);
    expect(
      before
        .getMutationCache()
        .getAll()
        .filter((m) => m.state.isPaused),
    ).toHaveLength(10);

    // "Restart": persist → new client → restore.
    const state = JSON.parse(JSON.stringify(dehydrate(before)));
    const after = new QueryClient();
    registerMutationDefaults(after);
    hydrate(after, state);

    onlineManager.setOnline(true);
    await act(async () => {
      await after.resumePausedMutations();
    });

    expect(mockCalls).toEqual([
      'mark:1',
      'status:["item-2","watching","2026-10-17T10:00:00.000Z"]',
      'mark:3',
      'status:["item-4","watching","2026-10-17T10:00:00.000Z"]',
      'mark:5',
      'status:["item-6","watching","2026-10-17T10:00:00.000Z"]',
      'mark:7',
      'status:["item-8","watching","2026-10-17T10:00:00.000Z"]',
      'mark:9',
      'status:["item-10","watching","2026-10-17T10:00:00.000Z"]',
    ]);
    expect(
      after
        .getMutationCache()
        .getAll()
        .every((m) => m.state.status === 'success'),
    ).toBe(true);
  });

  it('treats effects that already happened elsewhere as success', async () => {
    const client = createQueryClient();
    queue(client, MUTATION_KEYS.add, { titleId: 7, status: 'planned' });
    queue(client, MUTATION_KEYS.remove, { itemId: 'gone' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(mockCalls).toEqual(['add', 'remove']);
    expect(
      client
        .getMutationCache()
        .getAll()
        .map((m) => m.state.status),
    ).toEqual(['success', 'success']);
  });

  it('never persists watched-episode sets (not JSON-safe)', () => {
    expect(shouldPersistQuery({ state: { status: 'success', data: new Set([1]) } })).toBe(false);
    expect(shouldPersistQuery({ state: { status: 'success', data: [1] } })).toBe(true);
    expect(shouldPersistQuery({ state: { status: 'error', data: undefined } })).toBe(false);
  });
});

describe('LiveSyncProvider', () => {
  function setup() {
    const client = new QueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const view = render(
      <QueryClientProvider client={client}>
        <LiveSyncProvider userId="u1">
          <Text>child</Text>
        </LiveSyncProvider>
      </QueryClientProvider>,
    );
    return { invalidate, view };
  }

  it('refreshes list and progress on a valid signal only', async () => {
    const { invalidate } = setup();
    await act(async () => undefined);
    act(() => mockStatus?.('SUBSCRIBED'));

    act(() => mockBroadcast?.({ payload: { table: 'profiles', titleIds: [] } }));
    expect(invalidate).not.toHaveBeenCalled();

    act(() => mockBroadcast?.({ payload: { table: 'episode_progress', titleIds: [7] } }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...queryKeys.progress.all] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...queryKeys.watchlist.all] });
  });

  it('catches up after a reconnect and closes the channel on unmount', async () => {
    const { invalidate, view } = setup();
    await act(async () => undefined);
    act(() => mockStatus?.('SUBSCRIBED'));
    act(() => mockStatus?.('CLOSED'));
    act(() => mockStatus?.('SUBSCRIBED'));
    expect(invalidate).toHaveBeenCalledWith();

    view.unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});
