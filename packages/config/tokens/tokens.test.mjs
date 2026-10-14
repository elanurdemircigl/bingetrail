import { describe, expect, it } from 'vitest';

import tokens, { colors } from './index.mjs';

describe('design tokens', () => {
  it('exposes hex colors for every brand shade', () => {
    for (const value of Object.values(colors.brand)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('default export bundles all token groups', () => {
    expect(Object.keys(tokens)).toEqual(['colors', 'borderRadius']);
  });
});
