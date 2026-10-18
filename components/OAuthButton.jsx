import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import GoogleIcon from '@/components/icons/GoogleIcon';
import MicrosoftIcon from '@/components/icons/MicrosoftIcon';
import { useTheme } from '@/hooks/useTheme';

// Official sign-in button styling: light background, subtle border, dark label
// and the provider's unmodified multicolor logo — per Google and Microsoft
// brand guidelines.
const PROVIDERS = {
  google: { label: 'Sign in with Google', Icon: GoogleIcon },
  microsoft: { label: 'Sign in with Microsoft', Icon: MicrosoftIcon },
};

export default function OAuthButton({ provider, onPress, loading, disabled }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { label, Icon } = PROVIDERS[provider];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        (pressed || isDisabled) && styles.buttonDimmed,
      ]}>
      <View style={styles.icon}>
        <Icon size={20} />
      </View>
      {loading ? (
        <ActivityIndicator color={t.colors.text} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const makeStyles = (t) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing(3),
    borderWidth: 1,
    borderColor: '#DADCE0', // Google's neutral border for the light button
    borderRadius: t.radius.md,
    paddingVertical: t.spacing(3),
    paddingHorizontal: t.spacing(4),
    backgroundColor: '#FFFFFF',
  },
  buttonDimmed: {
    opacity: 0.6,
  },
  icon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F1F1F', // Google's near-black label color
  },
});
