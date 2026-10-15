import { describe, expect, it } from 'vitest';

import {
  forgotPasswordSchema,
  localeSchema,
  newPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from './index';

const firstCode = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe('emailSchema (via forgotPasswordSchema)', () => {
  it('trims and lower-cases the address', () => {
    expect(forgotPasswordSchema.parse({ email: '  Ayse@Example.COM ' })).toEqual({
      email: 'ayse@example.com',
    });
  });

  it.each(['', 'not-an-email', 'a@', '@b.com'])('rejects %j', (email) => {
    const code = firstCode(forgotPasswordSchema.safeParse({ email }));
    expect(['required', 'emailInvalid']).toContain(code);
  });
});

describe('newPasswordSchema', () => {
  it.each([
    ['short1', 'passwordTooShort'],
    ['onlyletters', 'passwordNeedsDigit'],
    ['12345678', 'passwordNeedsLetter'],
    ['a1'.repeat(37), 'passwordTooLong'],
  ])('rejects %j with %s', (password, code) => {
    expect(firstCode(newPasswordSchema.safeParse(password))).toBe(code);
  });

  it('counts bytes, not characters, for the 72-byte bcrypt limit', () => {
    // 36 two-byte Turkish characters = 72 bytes (ok); one more digit tips it over.
    expect(newPasswordSchema.safeParse(`${'ş'.repeat(35)}a1`).success).toBe(true);
    expect(firstCode(newPasswordSchema.safeParse(`${'ş'.repeat(36)}a1`))).toBe('passwordTooLong');
  });

  it('accepts a password matching the Supabase policy', () => {
    expect(newPasswordSchema.safeParse('binge2026').success).toBe(true);
  });
});

describe('signUpSchema', () => {
  it('requires matching passwords and reports it on confirmPassword', () => {
    const result = signUpSchema.safeParse({
      email: 'a@example.com',
      password: 'binge2026',
      confirmPassword: 'binge2027',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['confirmPassword'],
      message: 'passwordsDontMatch',
    });
  });
});

describe('signInSchema', () => {
  it('does not apply the new-password policy to existing passwords', () => {
    expect(signInSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true);
  });

  it('requires a password', () => {
    expect(firstCode(signInSchema.safeParse({ email: 'a@example.com', password: '' }))).toBe(
      'required',
    );
  });
});

describe('resetPasswordSchema', () => {
  it('applies the new-password policy', () => {
    expect(
      firstCode(resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' })),
    ).toBe('passwordTooShort');
  });
});

describe('localeSchema', () => {
  it('accepts supported locales only', () => {
    expect(localeSchema.safeParse('en').success).toBe(true);
    expect(localeSchema.safeParse('de').success).toBe(false);
  });
});
