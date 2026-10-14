import { describe, expect, it } from 'vitest';

import { WATCH_STATUSES, watchStatusSchema } from './index';

describe('watchStatusSchema', () => {
  it.each(WATCH_STATUSES)('accepts %s', (status) => {
    expect(watchStatusSchema.parse(status)).toBe(status);
  });

  it('rejects unknown statuses', () => {
    expect(watchStatusSchema.safeParse('binged').success).toBe(false);
  });
});
