import { describe, expect, it } from 'vitest';

import { LOCALES, messages } from '@bingetrail/i18n';

import { AUTH_ERROR_CODES, PASSWORD_MIN_LENGTH, VALIDATION_CODES } from './index';

// Every code the schemas or server can emit must be translatable in every locale.
describe('auth codes are translated', () => {
  it.each(LOCALES)('%s has a message for every validation code', (locale) => {
    for (const code of VALIDATION_CODES) {
      expect(messages[locale].validation[code], `${locale}.validation.${code}`).toBeTruthy();
    }
  });

  it.each(LOCALES)('%s has a message for every auth error code', (locale) => {
    for (const code of AUTH_ERROR_CODES) {
      expect(messages[locale].errors[code], `${locale}.errors.${code}`).toBeTruthy();
    }
  });

  it.each(LOCALES)('%s states the real minimum password length', (locale) => {
    expect(messages[locale].validation.passwordTooShort).toContain(String(PASSWORD_MIN_LENGTH));
    expect(messages[locale].auth.signup.passwordHint).toContain(String(PASSWORD_MIN_LENGTH));
  });
});
