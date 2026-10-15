import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/ui';
import { useSession } from '@/lib/auth/session';
import { colors } from '@/theme';

/** Guest-only screens: signed-in users go straight to the app. */
export default function AuthLayout() {
  const { session, loading } = useSession();
  if (loading) return <Loading />;
  if (session) return <Redirect href="/home" />;
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
    />
  );
}
