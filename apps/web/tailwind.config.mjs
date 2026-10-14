import { tokens } from '@bingetrail/config/tokens';

/** Loaded from app/globals.css via `@config` so web and mobile share one token source. */
export default {
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.borderRadius,
    },
  },
};
