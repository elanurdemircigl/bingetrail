import type { Database } from '@bingetrail/db-types';
import type { SupabaseClient } from '@supabase/supabase-js';

/** The client shape every data-access function accepts; injected by the app. */
export type TypedSupabaseClient = SupabaseClient<Database>;
