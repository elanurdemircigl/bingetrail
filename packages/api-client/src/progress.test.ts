import { describe, expect, it, vi } from 'vitest';

import {
  getContinueWatching,
  getTitleProgress,
  getWatchedEpisodeIds,
  markEpisodesWatched,
  ProgressError,
  queryKeys,
  unmarkEpisodes,
  type TypedSupabaseClient,
} from './index';

function fakeClient(rpcResult: { data?: unknown; error?: unknown }, rows: unknown[] = []) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null, ...rpcResult });
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  const client = { rpc, from: () => builder };
  return { client: client as unknown as TypedSupabaseClient, rpc, calls };
}

const row = (overrides: Record<string, unknown> = {}) => ({
  item_id: 'item-1',
  title_id: 7,
  tmdb_id: 1399,
  media_type: 'tv',
  original_title: 'Northern Keep',
  translations: { tr: { title: 'Kuzey Kalesi' } },
  poster_path: null,
  last_activity_at: '2026-10-16T10:00:00Z',
  next_episode_id: 41,
  next_season_number: 1,
  next_episode_number: 2,
  next_episode_name: { en: "The King's Road", tr: 'Kral Yolu' },
  next_air_date: '2011-04-24',
  watched_count: 1,
  aired_count: 4,
  ...overrides,
});

describe('mark / unmark', () => {
  it('sends all ids in a single RPC call', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    const { client, rpc } = fakeClient({ data: 150 });
    await expect(markEpisodesWatched(client, ids)).resolves.toBe(150);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('mark_episodes_watched', { p_episode_ids: ids });
  });

  it.each(['episode_not_aired', 'episode_not_found', 'too_many_episodes'])(
    'maps the database error %s to a code',
    async (message) => {
      const { client } = fakeClient({ error: { code: '22023', message } });
      await expect(markEpisodesWatched(client, [1])).rejects.toMatchObject({ code: message });
    },
  );

  it('hides any other database error', async () => {
    const { client } = fakeClient({ error: { code: '42501', message: 'permission denied' } });
    const error = await unmarkEpisodes(client, [1]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProgressError);
    expect(error).toMatchObject({ code: 'unexpected' });
  });
});

describe('reads', () => {
  it('returns the watched ids of a title as a set', async () => {
    const { client, calls } = fakeClient({}, [{ episode_id: 3 }, { episode_id: 5 }]);
    expect(await getWatchedEpisodeIds(client, 7)).toEqual(new Set([3, 5]));
    expect(calls).toContainEqual(['eq', 'title_id', 7]);
  });

  it('maps title progress, defaulting to "nothing known"', async () => {
    const full = fakeClient({
      data: [{ aired_count: 5, watched_count: 3, catalog_complete: true }],
    });
    expect(await getTitleProgress(full.client, 7)).toEqual({
      airedCount: 5,
      watchedCount: 3,
      catalogComplete: true,
    });
    const empty = fakeClient({ data: [] });
    expect(await getTitleProgress(empty.client, 7)).toEqual({
      airedCount: 0,
      watchedCount: 0,
      catalogComplete: false,
    });
  });

  it('localizes Continue Watching rows and handles missing next episodes', async () => {
    const { client, rpc } = fakeClient({
      data: [
        row(),
        row({
          item_id: 'item-2',
          media_type: 'movie',
          next_episode_id: null,
          next_season_number: null,
          next_episode_number: null,
          next_episode_name: null,
          next_air_date: null,
        }),
      ],
    });
    const [series, movie] = await getContinueWatching(client, 'tr');
    expect(rpc).toHaveBeenCalledWith('get_continue_watching', { p_limit: 20 });
    expect(series?.title).toBe('Kuzey Kalesi');
    expect(series?.nextEpisode).toEqual({
      id: 41,
      seasonNumber: 1,
      episodeNumber: 2,
      name: 'Kral Yolu',
      airDate: '2011-04-24',
    });
    expect(movie?.nextEpisode).toBeNull();
  });

  it('falls back to another language for the episode name', async () => {
    const { client } = fakeClient({ data: [row({ next_episode_name: { en: 'Only English' } })] });
    const [item] = await getContinueWatching(client, 'tr');
    expect(item?.nextEpisode?.name).toBe('Only English');
  });
});

describe('progress query keys', () => {
  it('nest under the progress root', () => {
    expect(queryKeys.progress.title(7).slice(0, 2)).toEqual([...queryKeys.progress.all]);
    expect(queryKeys.progress.continueWatching('tr')).not.toEqual(
      queryKeys.progress.continueWatching('en'),
    );
  });
});
