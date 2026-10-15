import { getTranslations } from 'next-intl/server';

import type { CatalogErrorCode } from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';

/** User-facing message for a failed catalog call (code only, never upstream details). */
export async function CatalogErrorNotice({ code }: { code: CatalogErrorCode }) {
  const t = await getTranslations('catalog.errors');
  return <FormAlert>{t(code)}</FormAlert>;
}
