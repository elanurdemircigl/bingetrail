import { describe, expect, it } from 'vitest';

import {
  applyStatusChange,
  NOTES_MAX_LENGTH,
  notesSchema,
  parseWatchlistFilters,
  ratingSchema,
  updateWatchlistDetailsSchema,
  WATCH_STATUSES,
  type StatusDates,
} from './index';

const NOW = '2026-10-15T12:00:00.000Z';
const EARLIER = '2026-10-01T09:00:00.000Z';

/** Same rules as the database constraints (watchlist_consistency migration). */
function satisfiesDbConstraints(s: StatusDates) {
  return (
    (s.completedAt === null || s.status === 'completed') &&
    (!['watching', 'completed'].includes(s.status) || s.startedAt !== null) &&
    (s.completedAt === null || s.startedAt === null || s.completedAt >= s.startedAt)
  );
}

describe('applyStatusChange', () => {
  it.each([
    ['planned', null, null],
    ['watching', NOW, null],
    ['completed', NOW, NOW],
    ['paused', null, null],
    ['dropped', null, null],
  ] as const)('a new item with status %s', (status, startedAt, completedAt) => {
    expect(applyStatusChange(null, status, NOW)).toEqual({ status, startedAt, completedAt });
  });

  it('keeps the original start date when continuing', () => {
    const watching = { startedAt: EARLIER, completedAt: null };
    expect(applyStatusChange(watching, 'completed', NOW)).toEqual({
      status: 'completed',
      startedAt: EARLIER,
      completedAt: NOW,
    });
    expect(applyStatusChange(watching, 'paused', NOW).startedAt).toBe(EARLIER);
  });

  it('clears the finish date when re-watching a completed title', () => {
    expect(applyStatusChange({ startedAt: EARLIER, completedAt: NOW }, 'watching', NOW)).toEqual({
      status: 'watching',
      startedAt: EARLIER,
      completedAt: null,
    });
  });

  it('every transition from every state satisfies the database constraints', () => {
    const states: Array<StatusDates | null> = [
      null,
      ...WATCH_STATUSES.map((status) => applyStatusChange(null, status, EARLIER)),
    ];
    for (const from of states) {
      for (const to of WATCH_STATUSES) {
        const result = applyStatusChange(from, to, NOW);
        expect(satisfiesDbConstraints(result), `${from?.status ?? 'new'} → ${to}`).toBe(true);
      }
    }
  });
});

describe('rating and notes', () => {
  it('accepts 1–10 or no rating', () => {
    for (const ok of [1, 10, null]) expect(ratingSchema.safeParse(ok).success).toBe(true);
    for (const bad of [0, 11, 7.5]) {
      expect(ratingSchema.safeParse(bad).error?.issues[0]?.message).toBe('ratingRange');
    }
  });

  it('stores blank notes as null and limits length', () => {
    expect(notesSchema.parse('   ')).toBeNull();
    expect(notesSchema.parse('Harika final.')).toBe('Harika final.');
    expect(notesSchema.safeParse('x'.repeat(NOTES_MAX_LENGTH)).success).toBe(true);
    expect(notesSchema.safeParse('x'.repeat(NOTES_MAX_LENGTH + 1)).error?.issues[0]?.message).toBe(
      'notesTooLong',
    );
  });

  it('keeps markup in notes as plain text (rendering escapes it)', () => {
    expect(notesSchema.parse('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });

  it('requires a valid item id', () => {
    expect(
      updateWatchlistDetailsSchema.safeParse({ itemId: 'not-a-uuid', rating: 5, notes: null })
        .success,
    ).toBe(false);
  });
});

describe('parseWatchlistFilters', () => {
  it('accepts known values', () => {
    expect(parseWatchlistFilters({ status: 'watching', sort: 'rating' })).toEqual({
      status: 'watching',
      sort: 'rating',
    });
  });

  it.each([{ status: 'binged', sort: 'evil' }, { status: ['planned'], sort: 1 }, {}])(
    'falls back for %j',
    (raw) => {
      expect(parseWatchlistFilters(raw)).toEqual({ status: null, sort: 'recent' });
    },
  );
});
