import { describe, expect, it, vi } from 'vitest';

import {
  AccountError,
  addToWatchlist,
  deleteAccount,
  getWatchlist,
  getWatchlistCounts,
  queryKeys,
  removeFromWatchlist,
  updateWatchlistDetails,
  updateWatchlistStatus,
  WatchlistError,
  type TypedSupabaseClient,
} from './index';

const NOW = '2026-10-15T12:00:00.000Z';

/** Chainable stand-in for the query builder; each awaited query takes the next result. */
function fakeClient(results: Array<{ data?: unknown; error?: unknown }>) {
  const calls: unknown[][] = [];
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const method of [
      'select',
      'eq',
      'order',
      'insert',
      'update',
      'delete',
      'maybeSingle',
      'single',
    ]) {
      b[method] = (...args: unknown[]) => {
        calls.push([table, method, ...args]);
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, ...results.shift() }).then(resolve, reject);
    return b;
  };
  const invoke = vi.fn();
  const client = { from: (table: string) => builder(table), functions: { invoke } };
  return { client: client as unknown as TypedSupabaseClient, calls, invoke };
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  title_id: 7,
  status: 'watching',
  rating: 8,
  notes: 'not',
  started_at: NOW,
  completed_at: null,
  last_activity_at: NOW,
  created_at: NOW,
  titles: {
    tmdb_id: 1399,
    media_type: 'tv',
    original_title: 'Northern Keep',
    translations: { tr: { title: 'Kuzey Kalesi', overview: null }, en: { title: 'Northern Keep' } },
    poster_path: null,
    release_date: '2011-04-17',
  },
  ...overrides,
});

describe('getWatchlist', () => {
  it('maps rows with the localized title and applies the status filter', async () => {
    const { client, calls } = fakeClient([{ data: [row()] }]);
    const items = await getWatchlist(client, { status: 'watching', sort: 'recent', locale: 'tr' });
    expect(items[0]?.title.title).toBe('Kuzey Kalesi');
    expect(calls).toContainEqual(['watchlist_items', 'eq', 'status', 'watching']);
    expect(calls).toContainEqual([
      'watchlist_items',
      'order',
      'last_activity_at',
      { ascending: false },
    ]);
  });

  it('falls back to another locale, then to the original title', async () => {
    const { client } = fakeClient([
      {
        data: [
          row({ titles: { ...row().titles, translations: { tr: { title: 'Kuzey Kalesi' } } } }),
          row({ id: 'item-2', titles: { ...row().titles, translations: {} } }),
        ],
      },
    ]);
    const items = await getWatchlist(client, { status: null, sort: 'recent', locale: 'en' });
    expect(items.map((i) => i.title.title)).toEqual(['Kuzey Kalesi', 'Northern Keep']);
  });

  it('sorts alphabetically with the locale collator', async () => {
    const titled = (id: string, title: string) =>
      row({ id, titles: { ...row().titles, translations: { tr: { title } } } });
    const { client } = fakeClient([
      { data: [titled('a', 'Zeytin'), titled('b', 'Çay'), titled('c', 'Bal')] },
    ]);
    const items = await getWatchlist(client, { status: null, sort: 'title', locale: 'tr' });
    expect(items.map((i) => i.title.title)).toEqual(['Bal', 'Çay', 'Zeytin']);
  });
});

describe('mutations', () => {
  it('adds with dates derived from the status', async () => {
    const { client, calls } = fakeClient([{ data: { id: 'new-id' } }]);
    await expect(addToWatchlist(client, { titleId: 7, status: 'completed' }, NOW)).resolves.toBe(
      'new-id',
    );
    expect(calls).toContainEqual([
      'watchlist_items',
      'insert',
      {
        title_id: 7,
        status: 'completed',
        started_at: NOW,
        completed_at: NOW,
        last_activity_at: NOW,
      },
    ]);
  });

  it('maps a duplicate add to already_exists', async () => {
    const { client } = fakeClient([{ error: { code: '23505' } }]);
    await expect(
      addToWatchlist(client, { titleId: 7, status: 'planned' }, NOW),
    ).rejects.toMatchObject({
      code: 'already_exists',
    });
  });

  it('status change keeps the original start date', async () => {
    const earlier = '2026-10-01T00:00:00.000Z';
    const { client, calls } = fakeClient([
      { data: { started_at: earlier, completed_at: null } },
      { data: [{ id: 'item-1' }] },
    ]);
    await updateWatchlistStatus(client, 'item-1', 'completed', NOW);
    expect(calls).toContainEqual([
      'watchlist_items',
      'update',
      { status: 'completed', started_at: earlier, completed_at: NOW, last_activity_at: NOW },
    ]);
  });

  it('reports not_found when RLS hides the row', async () => {
    const missing = fakeClient([{ data: null }]);
    await expect(updateWatchlistStatus(missing.client, 'x', 'paused', NOW)).rejects.toBeInstanceOf(
      WatchlistError,
    );
    const details = fakeClient([{ data: [] }]);
    await expect(
      updateWatchlistDetails(details.client, 'x', { rating: 5, notes: null }, NOW),
    ).rejects.toMatchObject({ code: 'not_found' });
    const removed = fakeClient([{ data: [] }]);
    await expect(removeFromWatchlist(removed.client, 'x')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('counts entries per status', async () => {
    const { client } = fakeClient([
      { data: [{ status: 'planned' }, { status: 'planned' }, { status: 'dropped' }] },
    ]);
    await expect(getWatchlistCounts(client)).resolves.toEqual({
      planned: 2,
      watching: 0,
      completed: 0,
      paused: 0,
      dropped: 1,
    });
  });
});

describe('deleteAccount', () => {
  it('sends only the password (the function uses the JWT subject)', async () => {
    const { client, invoke } = fakeClient([]);
    invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    await deleteAccount(client, 'binge2026');
    expect(invoke).toHaveBeenCalledWith('delete-account', { body: { password: 'binge2026' } });
  });

  it('maps function errors to AccountError codes', async () => {
    const { client, invoke } = fakeClient([]);
    invoke.mockResolvedValue({
      data: null,
      error: { context: { json: () => Promise.resolve({ error: 'reauth_failed' }) } },
    });
    await expect(deleteAccount(client, 'wrong')).rejects.toMatchObject({ code: 'reauth_failed' });
    invoke.mockResolvedValue({ data: { deleted: false }, error: null });
    await expect(deleteAccount(client, 'x')).rejects.toBeInstanceOf(AccountError);
  });
});

describe('watchlist query keys', () => {
  it('nest under the watchlist root', () => {
    expect(queryKeys.watchlist.list(null, 'recent', 'tr').slice(0, 2)).toEqual([
      ...queryKeys.watchlist.all,
    ]);
    expect(queryKeys.watchlist.list(null, 'recent', 'tr')).not.toEqual(
      queryKeys.watchlist.list('planned', 'recent', 'tr'),
    );
  });
});
