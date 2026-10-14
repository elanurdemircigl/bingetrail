import { describe, expect, it } from 'vitest';

import { queryKeys } from './index';

describe('queryKeys', () => {
  it('nests every domain key under the root key', () => {
    const detail = queryKeys.profile.detail('user-1');

    expect(detail.slice(0, queryKeys.all.length)).toEqual([...queryKeys.all]);
    expect(detail.slice(0, queryKeys.profile.all.length)).toEqual([...queryKeys.profile.all]);
  });

  it('produces distinct keys per user', () => {
    expect(queryKeys.profile.detail('a')).not.toEqual(queryKeys.profile.detail('b'));
  });
});
