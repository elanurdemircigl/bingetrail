import { measureClockOffset } from '@bingetrail/api-client';
import { toServerTime } from '@bingetrail/shared';

import { supabase } from '../supabase/client';

// Mobile writes timestamps (status dates, last activity) in SERVER time: a phone
// with a wrong clock must not create dates that contradict other devices or the
// database's date-order constraints. The offset is measured on start and on
// every reconnect (docs/sync.md).

let offsetMs = 0;
let measuring: Promise<number> | null = null;

/** Re-measures the server clock offset (call when the app comes online). */
export function refreshClockOffset(): Promise<number> {
  measuring = measureClockOffset(supabase)
    .then((offset) => (offsetMs = offset))
    .catch(() => offsetMs);
  return measuring;
}

/** Current time in server time; waits for a measurement in flight. */
export async function serverNowIso(): Promise<string> {
  await (measuring ?? refreshClockOffset());
  return toServerTime(new Date().toISOString(), offsetMs);
}
