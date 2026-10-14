import { Text, View } from 'react-native';

import { DEFAULT_LOCALE, messages } from '@bingetrail/i18n';

// Faz 0 skeleton screen. Mobile features start in Faz 6 (after web core is stable).
export default function HomeScreen() {
  const t = messages[DEFAULT_LOCALE];

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface px-6">
      <Text className="text-4xl font-bold text-brand-500">{t.app.name}</Text>
      <Text className="text-center text-lg text-ink">{t.app.tagline}</Text>
    </View>
  );
}
