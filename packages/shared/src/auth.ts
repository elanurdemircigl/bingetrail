import { z } from 'zod';

import { LOCALES } from '@bingetrail/i18n';

/**
 * Auth form schemas shared by web and mobile. Error messages are i18n codes
 * (rendered as `validation.<code>`), never user-facing text, so this package
 * stays language-agnostic.
 *
 * Password rules mirror supabase/config.toml: minimum_password_length = 8,
 * password_requirements = "letters_digits" (ASCII letters, like GoTrue checks).
 */
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt only uses the first 72 bytes; longer input would be silently truncated. */
export const PASSWORD_MAX_LENGTH = 72;

export const VALIDATION_CODES = [
  'required',
  'emailInvalid',
  'passwordTooShort',
  'passwordTooLong',
  'passwordNeedsLetter',
  'passwordNeedsDigit',
  'passwordsDontMatch',
  'ratingRange',
  'notesTooLong',
  'confirmRequired',
] as const;
export type ValidationCode = (typeof VALIDATION_CODES)[number];

/** Server-side outcomes surfaced to users. Deliberately coarse to avoid account enumeration. */
export const AUTH_ERROR_CODES = [
  'invalidCredentials',
  'weakPassword',
  'samePassword',
  'reauthRequired',
  'rateLimited',
  'linkInvalid',
  'unexpected',
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

const err = (code: ValidationCode) => ({ error: code });

/** UTF-8 byte length without TextEncoder, which is not available in every runtime typing. */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export const emailSchema = z
  .string(err('required'))
  .trim()
  .toLowerCase()
  .min(1, err('required'))
  .max(254, err('emailInvalid'))
  .pipe(z.email(err('emailInvalid')));

export const newPasswordSchema = z
  .string(err('required'))
  .min(PASSWORD_MIN_LENGTH, err('passwordTooShort'))
  .refine((value) => utf8ByteLength(value) <= PASSWORD_MAX_LENGTH, err('passwordTooLong'))
  .refine((value) => /[A-Za-z]/.test(value), err('passwordNeedsLetter'))
  .refine((value) => /\d/.test(value), err('passwordNeedsDigit'));

export const signInSchema = z.object({
  email: emailSchema,
  // Existing passwords are not re-validated against the current policy.
  password: z.string(err('required')).min(1, err('required')),
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(err('required')).min(1, err('required')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    ...err('passwordsDontMatch'),
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(err('required')).min(1, err('required')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    ...err('passwordsDontMatch'),
  });

export const localeSchema = z.enum(LOCALES);

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
