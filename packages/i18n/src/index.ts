import en from './messages/en.json';
import tr from './messages/tr.json';

export const LOCALES = ['tr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

/** Turkish is the source of truth for message shape; other locales must match it. */
export type Messages = typeof tr;

export const messages: Record<Locale, Messages> = { tr, en };

/** Flattens nested messages into dot paths, e.g. `app.name`. */
export function messageKeys(tree: object, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null ? messageKeys(value, path) : [path];
  });
}
