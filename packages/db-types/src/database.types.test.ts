import { describe, expectTypeOf, it } from 'vitest';

import type { Database } from './index';

describe('Database types', () => {
  it('exposes the public schema sections expected by supabase-js', () => {
    expectTypeOf<keyof Database['public']>().toEqualTypeOf<
      'Tables' | 'Views' | 'Functions' | 'Enums' | 'CompositeTypes'
    >();
  });
});
