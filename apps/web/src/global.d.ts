import type { Messages } from '@bingetrail/i18n';

import type { routing } from '@/i18n/routing';

// Typed message keys and locales for next-intl: a missing translation key is a type error.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
  }
}
