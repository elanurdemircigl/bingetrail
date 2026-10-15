import { describe, expect, it } from 'vitest';

import { deleteAccountFormSchema } from './index';

describe('deleteAccountFormSchema', () => {
  it('requires a password and an explicit acknowledgement', () => {
    expect(deleteAccountFormSchema.safeParse({ password: 'x', confirm: true }).success).toBe(true);

    const issues = (input: unknown) =>
      deleteAccountFormSchema.safeParse(input).error?.issues.map((i) => i.message) ?? [];
    expect(issues({ password: '', confirm: true })).toEqual(['required']);
    expect(issues({ password: 'x', confirm: false })).toEqual(['confirmRequired']);
    expect(issues({ password: 'x' })).toEqual(['confirmRequired']);
    expect(issues({ password: 'x'.repeat(1025), confirm: true })).toEqual(['passwordTooLong']);
  });
});
