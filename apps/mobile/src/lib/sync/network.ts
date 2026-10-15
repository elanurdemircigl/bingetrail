import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { refreshClockOffset } from './clock';

/**
 * Connectivity drives TanStack Query: while offline, mutations pause (queued,
 * persisted) and resume in order once the device is back online.
 */
export function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
      if (online && !onlineManager.isOnline()) void refreshClockOffset();
      setOnline(online);
    }),
  );
}

export const useIsOnline = () =>
  useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
