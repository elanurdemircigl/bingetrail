import { describe, expect, it, vi } from 'vitest';

import { getProfile, mapProfile, PROFILE_COLUMNS, updateProfileLocale } from './index';
import type { TypedSupabaseClient } from './index';

const row = {
  id: 'user-1',
  display_name: 'Ayşe',
  locale: 'en',
  timezone: 'Europe/Istanbul',
  avatar_path: null,
};

/** Minimal chainable stand-in for the supabase-js query builder. */
function fakeClient(result: { data?: unknown; error?: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ['select', 'update', 'eq']) {
    builder[method] = (...args) => {
      calls.push({ method, args });
      return method === 'eq' ? Object.assign(Promise.resolve(result), builder) : builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve(result);
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as TypedSupabaseClient, from, calls };
}

describe('mapProfile', () => {
  it('maps snake_case columns to the DTO', () => {
    expect(mapProfile(row)).toEqual({
      id: 'user-1',
      displayName: 'Ayşe',
      locale: 'en',
      timezone: 'Europe/Istanbul',
      avatarPath: null,
    });
  });

  it('falls back to the default locale for unexpected values', () => {
    expect(mapProfile({ ...row, locale: 'xx' }).locale).toBe('tr');
  });
});

describe('getProfile', () => {
  it('queries only the DTO columns of the given user', async () => {
    const { client, from, calls } = fakeClient({ data: row, error: null });

    await expect(getProfile(client, 'user-1')).resolves.toMatchObject({ displayName: 'Ayşe' });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(calls).toEqual([
      { method: 'select', args: [PROFILE_COLUMNS] },
      { method: 'eq', args: ['id', 'user-1'] },
    ]);
  });

  it('returns null when no row is visible', async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(getProfile(client, 'user-1')).resolves.toBeNull();
  });

  it('throws database errors instead of hiding them', async () => {
    const { client } = fakeClient({ data: null, error: new Error('boom') });
    await expect(getProfile(client, 'user-1')).rejects.toThrow('boom');
  });
});

describe('updateProfileLocale', () => {
  it('updates only the locale of the given user', async () => {
    const { client, calls } = fakeClient({ error: null });

    await updateProfileLocale(client, 'user-1', 'en');
    expect(calls).toEqual([
      { method: 'update', args: [{ locale: 'en' }] },
      { method: 'eq', args: ['id', 'user-1'] },
    ]);
  });

  it('throws when the update fails', async () => {
    const { client } = fakeClient({ error: new Error('denied') });
    await expect(updateProfileLocale(client, 'user-1', 'en')).rejects.toThrow('denied');
  });
});
