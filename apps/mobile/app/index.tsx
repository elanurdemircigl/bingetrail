import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useSession } from '@/lib/auth/session';

export default function Index() {
  const { session, loading } = useSession();
  if (loading) return <Loading />;
  return <Redirect href={session ? '/home' : '/login'} />;
}
