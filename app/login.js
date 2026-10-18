import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import OAuthButton from '@/components/OAuthButton';
import TressurerLogo from '@/components/icons/TressurerLogo';
import { signInWithOAuth } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/hooks/useTheme';

// SSO-only login: Google and Microsoft. No email/password by design.
export default function LoginScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const signIn = useAuthStore((s) => s.signIn);
  const [pendingProvider, setPendingProvider] = useState(null);

  const handleOAuth = async (provider) => {
    setPendingProvider(provider);
    try {
      const session = await signInWithOAuth(provider);
      if (!session) return; // user cancelled
      await signIn(session); // persists JWT + user, layout guard redirects to tabs
      Toast.show({
        type: 'success',
        text1: `Welcome${session.user?.name ? `, ${session.user.name}` : ''}`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Sign-in failed',
        text2: error?.message ?? 'Please try again.',
      });
    } finally {
      setPendingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <TressurerLogo size={96} />
      <Text style={styles.title}>Tressurer</Text>
      <Text style={styles.subtitle}>Sign in to your workspace</Text>

      <View style={styles.buttons}>
        <OAuthButton
          provider="google"
          loading={pendingProvider === 'google'}
          disabled={pendingProvider !== null}
          onPress={() => handleOAuth('google')}
        />
        <OAuthButton
          provider="microsoft"
          loading={pendingProvider === 'microsoft'}
          disabled={pendingProvider !== null}
          onPress={() => handleOAuth('microsoft')}
        />
      </View>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing(6),
    backgroundColor: t.colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: t.colors.primary,
    marginBottom: t.spacing(2),
  },
  subtitle: {
    fontSize: 15,
    color: t.colors.textMuted,
    marginBottom: t.spacing(10),
  },
  buttons: {
    alignSelf: 'stretch',
    gap: t.spacing(3),
  },
});
