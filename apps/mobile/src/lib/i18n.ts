import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, LOCALES, messages, type Locale } from '@bingetrail/i18n';

// Same TR/EN JSON as the web app (K12). Messages use ICU syntax
// ("{count, plural, …}"), hence the ICU plugin instead of i18next's own format.

const STORAGE_KEY = 'bt_locale';

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** Phone language if supported, otherwise Turkish. */
export function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return isLocale(code) ? code : DEFAULT_LOCALE;
}

export function initI18n(locale: Locale = deviceLocale()) {
  if (i18n.isInitialized) return i18n;
  void i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      resources: {
        tr: { translation: messages.tr },
        en: { translation: messages.en },
      },
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      interpolation: { escapeValue: false }, // React Native renders text, not HTML
      returnNull: false,
    });
  return i18n;
}

/** Restores a guest's explicit language choice (signed-in users follow their profile). */
export async function restoreSavedLocale() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  if (isLocale(saved) && saved !== i18n.language) await i18n.changeLanguage(saved);
}

export async function setAppLocale(locale: Locale) {
  await i18n.changeLanguage(locale);
  await AsyncStorage.setItem(STORAGE_KEY, locale).catch(() => undefined);
}

export const currentLocale = (): Locale =>
  isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;

export { i18n };
