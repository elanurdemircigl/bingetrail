import { tokens } from '@bingetrail/config/tokens';

/** Loaded from app/globals.css via `@config` so web and mobile share one token source. */
const tailwindConfig = {
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.borderRadius,
    },
  },
};

export default tailwindConfig;
