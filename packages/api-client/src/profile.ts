import type { Database } from '@bingetrail/db-types';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@bingetrail/i18n';

import type { TypedSupabaseClient } from './client-type';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/** Columns read for a profile; keep in sync with ProfileDTO. */
export const PROFILE_COLUMNS = 'id, display_name, locale, timezone, avatar_path' as const;

export type ProfileDTO = {
  id: string;
  displayName: string | null;
  locale: Locale;
  timezone: string;
  avatarPath: string | null;
};

const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

export function mapProfile(
  row: Pick<ProfileRow, 'id' | 'display_name' | 'locale' | 'timezone' | 'avatar_path'>,
): ProfileDTO {
  return {
    id: row.id,
    displayName: row.display_name,
    // The DB check constraint already limits locale; this keeps the type honest.
    locale: isLocale(row.locale) ? row.locale : DEFAULT_LOCALE,
    timezone: row.timezone,
    avatarPath: row.avatar_path,
  };
}

/** Returns the signed-in user's profile, or null if RLS hides it / it does not exist. */
export async function getProfile(
  client: TypedSupabaseClient,
  userId: string,
): Promise<ProfileDTO | null> {
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function updateProfileLocale(
  client: TypedSupabaseClient,
  userId: string,
  locale: Locale,
): Promise<void> {
  const { error } = await client.from('profiles').update({ locale }).eq('id', userId);
  if (error) throw error;
}
