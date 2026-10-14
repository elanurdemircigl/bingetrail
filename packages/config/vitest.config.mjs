import { defineConfig, mergeConfig } from 'vitest/config';

import base from './vitest/base.mjs';

export default mergeConfig(
  base,
  defineConfig({
    test: { include: ['tokens/**/*.test.mjs'] },
  }),
);
