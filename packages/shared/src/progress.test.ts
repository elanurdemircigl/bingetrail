import { describe, expect, it } from 'vitest';

import {
  airedIdsUpTo,
  episodeIdsSchema,
  isAired,
  MAX_EPISODES_PER_REQUEST,
  progressOf,
  shouldSuggestCompletion,
  toProgress,
  utcToday,
} from './index';

const TODAY = '2026-10-16';
const episodes = [
  { id: 11, episodeNumber: 1, airDate: '2026-01-01' },
  { id: 12, episodeNumber: 2, airDate: '2026-10-16' }, // airs today
  { id: 13, episodeNumber: 3, airDate: '2026-10-17' }, // tomorrow
  { id: 14, episodeNumber: 4, airDate: null }, // unknown
];

describe('air dates', () => {
  it.each([
    ['2026-10-15', true],
    ['2026-10-16', true],
    ['2026-10-17', false],
    [null, false],
  ] as const)('%s aired by %s → %s', (date, expected) => {
    expect(isAired(date, TODAY)).toBe(expected);
  });

  it('uses the UTC calendar date', () => {
    expect(utcToday(new Date('2026-10-16T23:30:00-05:00'))).toBe('2026-10-17');
  });
});

describe('progress', () => {
  it('counts only aired episodes', () => {
    expect(progressOf(episodes, new Set([11, 13]), TODAY)).toEqual({
      aired: 2,
      watched: 1,
      percent: 50,
    });
  });

  it.each([
    [0, 0, 0],
    [3, 0, 0],
    [3, 1, 33],
    [3, 3, 100],
    [3, 5, 100],
  ])('aired %i, watched %i → %i%%', (aired, watched, percent) => {
    expect(toProgress(aired, watched).percent).toBe(percent);
  });

  it('"mark up to here" skips unaired episodes', () => {
    expect(airedIdsUpTo(episodes, 4, TODAY)).toEqual([11, 12]);
    expect(airedIdsUpTo(episodes, 1, TODAY)).toEqual([11]);
  });
});

describe('completion suggestion', () => {
  const base = {
    status: 'watching' as const,
    airedCount: 10,
    watchedCount: 10,
    catalogComplete: true,
  };

  it('is offered when every aired episode is watched', () => {
    expect(shouldSuggestCompletion(base)).toBe(true);
  });

  it.each([
    ['already completed', { status: 'completed' as const }],
    ['not on the list', { status: null }],
    ['episodes left', { watchedCount: 9 }],
    ['nothing aired yet', { airedCount: 0, watchedCount: 0 }],
    ['seasons missing from the cache', { catalogComplete: false }],
  ])('is not offered when %s', (_, override) => {
    expect(shouldSuggestCompletion({ ...base, ...override })).toBe(false);
  });
});

describe('episodeIdsSchema', () => {
  it('bounds the request size', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    expect(episodeIdsSchema.safeParse({ episodeIds: ids(150) }).success).toBe(true);
    expect(
      episodeIdsSchema.safeParse({ episodeIds: ids(MAX_EPISODES_PER_REQUEST + 1) }).success,
    ).toBe(false);
    expect(episodeIdsSchema.safeParse({ episodeIds: [] }).success).toBe(false);
    expect(episodeIdsSchema.safeParse({ episodeIds: [0] }).success).toBe(false);
  });
});
