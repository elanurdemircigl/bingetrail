import { describe, expect, it } from 'vitest';

import { toAuthErrorCode } from './index';

describe('toAuthErrorCode', () => {
  it.each([
    ['over_request_rate_limit', 'rateLimited'],
    ['over_email_send_rate_limit', 'rateLimited'],
    ['weak_password', 'weakPassword'],
    ['same_password', 'samePassword'],
    ['reauthentication_needed', 'reauthRequired'],
  ] as const)('maps %s to %s', (code, expected) => {
    expect(toAuthErrorCode({ code }, 'unexpected')).toBe(expected);
  });

  it.each(['invalid_credentials', 'email_not_confirmed', 'user_not_found', 'user_already_exists'])(
    'hides account-revealing code %s behind the fallback',
    (code) => {
      expect(toAuthErrorCode({ code }, 'invalidCredentials')).toBe('invalidCredentials');
    },
  );

  it('treats HTTP 429 without a code as rate limiting', () => {
    expect(toAuthErrorCode({ status: 429 }, 'unexpected')).toBe('rateLimited');
  });

  it('uses the fallback for missing errors', () => {
    expect(toAuthErrorCode(null, 'unexpected')).toBe('unexpected');
  });
});
