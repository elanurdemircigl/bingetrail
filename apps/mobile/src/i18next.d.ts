import 'i18next';

import type { Messages } from '@bingetrail/i18n';

// Type-checked translation keys: t('catalog.search.label') autocompletes and a
// typo fails `tsc`, like next-intl on the web.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Messages };
    returnNull: false;
  }
}
