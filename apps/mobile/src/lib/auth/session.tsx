import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getProfile } from '@bingetrail/api-client';

import { i18n } from '../i18n';
import { supabase } from '../supabase/client';

type SessionContextValue = {
  session: Session | null;
  /** True until the stored session has been read. */
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionContextValue>({ session: null, loading: true });

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      // Another user (or none): never show the previous user's cached data.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') queryClient.clear();
      // The profile language follows the user across devices (like the web).
      if (session && event === 'SIGNED_IN') {
        void getProfile(supabase, session.user.id)
          .then((profile) => {
            if (profile && profile.locale !== i18n.language)
              void i18n.changeLanguage(profile.locale);
          })
          .catch(() => undefined);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
