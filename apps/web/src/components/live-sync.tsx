'use client';

import { createClient } from '@supabase/supabase-js';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { parseSyncEvent } from '@bingetrail/api-client';
import { SYNC_EVENT } from '@bingetrail/shared';

import { getSupabaseEnv } from '@/lib/env';

type State = 'connecting' | 'live' | 'offline';

/**
 * Listens for "your data changed" signals from other devices and re-renders the
 * page from the server (cookie session, RLS). The browser client has the
 * publishable key ONLY — no session, no token (ADR-0002, ADR-0007). The topic is
 * an unguessable per-user HMAC and signals carry no personal data.
 */
export function LiveSync({ topic }: { topic: string | null }) {
  const t = useTranslations('sync');
  const router = useRouter();
  const [state, setState] = useState<State>('connecting');

  useEffect(() => {
    if (!topic) return;
    const { url, publishableKey } = getSupabaseEnv();
    const client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasLive = false;
    // Several signals in a row (bulk edits) become one refresh.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
    };

    const channel = client
      .channel(topic, { config: { private: false } })
      .on('broadcast', { event: SYNC_EVENT }, ({ payload }) => {
        if (parseSyncEvent(payload)) refresh();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Back after a drop: catch up on anything missed meanwhile.
          if (wasLive) refresh();
          wasLive = true;
          setState('live');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setState('offline');
        }
      });

    const goOffline = () => setState('offline');
    window.addEventListener('offline', goOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('offline', goOffline);
      // No leaked sockets on navigation/unmount.
      void client.removeChannel(channel);
    };
  }, [topic, router]);

  if (!topic) return null;
  return (
    // A persistent indicator, not an announcement: no live region (screen readers
    // would hear "Live" on every page). The label gives it a name.
    <span
      title={t('label')}
      data-testid="sync-status"
      data-state={state}
      className="text-ink-muted flex items-center gap-1.5 text-xs"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          state === 'live'
            ? 'bg-emerald-500'
            : state === 'offline'
              ? 'bg-brand-500'
              : 'bg-ink-muted'
        }`}
      />
      <span className="sr-only">{t('label')}: </span>
      {t(state)}
    </span>
  );
}
