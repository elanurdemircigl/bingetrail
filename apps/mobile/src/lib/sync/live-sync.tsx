import { useMutationState, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getRealtimeTopic, parseSyncEvent, queryKeysForSyncEvent } from '@bingetrail/api-client';
import { SYNC_EVENT } from '@bingetrail/shared';

import { supabase } from '../supabase/client';

import { useIsOnline } from './network';

export type LiveState = 'connecting' | 'live' | 'offline';

const LiveSyncContext = createContext<LiveState>('connecting');

/**
 * Subscribes to the user's private sync topic while signed in. A signal (from
 * the web or another phone) refreshes the affected queries; a reconnect
 * refreshes everything that may have been missed. The channel is removed on
 * sign-out/unmount, so no socket outlives the session.
 */
export function LiveSyncProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LiveState>('connecting');

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let wasLive = false;

    void getRealtimeTopic(supabase).then((topic) => {
      if (cancelled || !topic) return;
      channel = supabase
        .channel(topic, { config: { private: false } })
        .on('broadcast', { event: SYNC_EVENT }, ({ payload }) => {
          const event = parseSyncEvent(payload);
          if (!event) return;
          for (const queryKey of queryKeysForSyncEvent(event)) {
            void queryClient.invalidateQueries({ queryKey: [...queryKey] });
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            if (wasLive) void queryClient.invalidateQueries();
            wasLive = true;
            setState('live');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setState('offline');
          }
        });
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return <LiveSyncContext.Provider value={state}>{children}</LiveSyncContext.Provider>;
}

/** Realtime state, reported as offline whenever the device has no connection. */
export function useLiveState(): LiveState {
  const state = useContext(LiveSyncContext);
  return useIsOnline() ? state : 'offline';
}

/** Number of changes waiting for the connection (paused mutations). */
export const usePendingChanges = () =>
  useMutationState({ filters: { predicate: (m) => m.state.isPaused } }).length;
