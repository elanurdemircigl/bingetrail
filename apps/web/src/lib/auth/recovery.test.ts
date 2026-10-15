import { describe, expect, it } from 'vitest';

import { createRecoveryMarker, isValidRecoveryMarker, RECOVERY_TTL_SECONDS } from './recovery';

// Built at runtime and low-entropy so no secret-shaped literal is committed (gitleaks).
const SECRET = 'k'.repeat(40);
const binding = { userId: 'user-1', sessionId: 'session-1' };
const NOW = Date.UTC(2026, 9, 15, 12);

const marker = () => createRecoveryMarker(binding, NOW, SECRET)!;

describe('recovery marker', () => {
  it('is valid for the same user and session within 15 minutes', () => {
    expect(isValidRecoveryMarker(marker(), binding, NOW + 60_000, SECRET)).toBe(true);
  });

  it('expires after the TTL', () => {
    const later = NOW + (RECOVERY_TTL_SECONDS + 1) * 1000;
    expect(isValidRecoveryMarker(marker(), binding, later, SECRET)).toBe(false);
  });

  it('is bound to the user and to the exact session', () => {
    expect(isValidRecoveryMarker(marker(), { ...binding, userId: 'user-2' }, NOW, SECRET)).toBe(
      false,
    );
    expect(
      isValidRecoveryMarker(marker(), { ...binding, sessionId: 'session-2' }, NOW, SECRET),
    ).toBe(false);
    expect(isValidRecoveryMarker(marker(), null, NOW, SECRET)).toBe(false);
  });

  it('rejects forged or tampered values', () => {
    const [payload, signature] = marker().split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'user-1', sid: 'session-1', exp: 9_999_999_999 }),
    ).toString('base64url');

    for (const value of [
      `${forgedPayload}.${signature}`,
      `${payload}.${'A'.repeat(signature!.length)}`,
      `${payload}.`,
      payload,
      `${payload}.${signature}.extra`,
      'not-a-marker',
      '',
      undefined,
    ]) {
      expect(isValidRecoveryMarker(value, binding, NOW, SECRET), String(value)).toBe(false);
    }
  });

  it('is rejected under a different secret', () => {
    expect(isValidRecoveryMarker(marker(), binding, NOW, `${SECRET}-rotated`)).toBe(false);
  });

  it('fails closed without a (long enough) server secret', () => {
    expect(createRecoveryMarker(binding, NOW, null)).toBeNull();
    expect(isValidRecoveryMarker(marker(), binding, NOW, null)).toBe(false);
  });
});
