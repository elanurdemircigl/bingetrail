import { describe, expectTypeOf, it } from 'vitest';

import type { Database } from './index';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

// These are compile-time assertions: `tsc --noEmit` fails if the generated types
// drift from the schema the app code expects. Regenerate with `pnpm db:types`.
describe('Database types', () => {
  it('exposes every table', () => {
    expectTypeOf<keyof Tables>().toEqualTypeOf<
      | 'account_deletion_log'
      | 'episode_progress'
      | 'episodes'
      | 'maintenance_reports'
      | 'profiles'
      | 'rate_limits'
      | 'seasons'
      | 'titles'
      | 'watchlist_items'
    >();
  });

  it('mirrors the Postgres enums', () => {
    expectTypeOf<Enums['watch_status']>().toEqualTypeOf<
      'planned' | 'watching' | 'completed' | 'paused' | 'dropped'
    >();
    expectTypeOf<Enums['media_type']>().toEqualTypeOf<'movie' | 'tv'>();
  });

  it('lets clients omit user_id on insert (it defaults to auth.uid())', () => {
    expectTypeOf<Tables['watchlist_items']['Insert']['user_id']>().toEqualTypeOf<
      string | undefined
    >();
  });
});
