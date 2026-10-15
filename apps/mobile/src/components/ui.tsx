import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toProgress } from '@bingetrail/shared';
import { colors } from '@/theme';

/** Scrollable page with safe-area padding. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = <View className="gap-4 px-4 py-4">{children}</View>;
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['left', 'right', 'bottom']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export const Title = ({ children }: { children: ReactNode }) => (
  <Text accessibilityRole="header" className="text-2xl font-bold text-ink">
    {children}
  </Text>
);

export const Heading = ({ children }: { children: ReactNode }) => (
  <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
    {children}
  </Text>
);

export const Muted = ({ children, testID }: { children: ReactNode; testID?: string }) => (
  <Text testID={testID} className="text-sm text-ink-muted">
    {children}
  </Text>
);

const TONES = {
  primary: 'bg-brand-600',
  secondary: 'bg-surface-raised',
  danger: 'bg-red-700',
} as const;

export function Button({
  label,
  onPress,
  pending = false,
  pendingLabel,
  disabled = false,
  tone = 'primary',
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  pending?: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  tone?: keyof typeof TONES;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const inactive = disabled || pending;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: pending }}
      disabled={inactive}
      onPress={onPress}
      className={`min-h-11 items-center justify-center rounded-lg px-4 py-2 ${TONES[tone]} ${inactive ? 'opacity-60' : ''}`}
    >
      <Text className={`font-semibold ${tone === 'secondary' ? 'text-ink' : 'text-white'}`}>
        {pending ? (pendingLabel ?? label) : label}
      </Text>
    </Pressable>
  );
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="min-h-11 justify-center">
      <Text className="text-brand-500 underline">{label}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string | undefined; hint?: string | undefined }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.inkMuted}
        className={`rounded-lg border bg-surface px-3 py-2 text-ink ${error ? 'border-brand-500' : 'border-surface-muted'}`}
        {...input}
      />
      {hint ? <Text className="text-xs text-ink-muted">{hint}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-sm text-brand-500">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Alert({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'success';
}) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className={`rounded-lg border px-3 py-2 ${tone === 'error' ? 'border-brand-600 bg-brand-600/10' : 'border-emerald-500 bg-emerald-500/10'}`}
    >
      <Text className="text-sm text-ink">{children}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-9 justify-center rounded-full px-3 py-1.5 ${selected ? 'bg-brand-600' : 'bg-surface-raised'} ${disabled ? 'opacity-60' : ''}`}
    >
      <Text className={selected ? 'text-white' : 'text-ink'}>{label}</Text>
    </Pressable>
  );
}

export const Loading = () => (
  <View className="items-center py-8">
    <ActivityIndicator />
  </View>
);

/** TMDB poster or a neutral placeholder (TMDB images CDN only). */
export function Poster({
  path,
  title,
  width = 92,
}: {
  path: string | null;
  title: string;
  width?: number;
}) {
  const height = Math.round(width * 1.5);
  if (!path) {
    return (
      <View
        accessible
        accessibilityLabel={title}
        style={{ width, height }}
        className="items-center justify-center rounded-card bg-surface-muted"
      >
        <Text className="p-1 text-center text-xs text-ink-muted">{title}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: `https://image.tmdb.org/t/p/${width > 185 ? 'w342' : 'w185'}${path}` }}
      accessibilityLabel={title}
      style={{ width, height, borderRadius: 12 }}
      contentFit="cover"
    />
  );
}

export function ProgressBar({
  aired,
  watched,
  text,
  testID,
}: {
  aired: number;
  watched: number;
  text: string;
  testID?: string;
}) {
  const progress = toProgress(aired, watched);
  return (
    <View className="gap-1" testID={testID}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: progress.aired, now: progress.watched, text }}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <View
          className="h-full rounded-full bg-brand-600"
          style={{ width: `${progress.percent}%` }}
        />
      </View>
      <Text className="text-sm text-ink-muted">{text}</Text>
    </View>
  );
}
