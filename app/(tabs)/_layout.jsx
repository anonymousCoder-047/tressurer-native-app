import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Tabs, router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useTheme } from '@/hooks/useTheme';

const icon = (ios, android) => {
  function TabIcon({ color }) {
    return <SymbolView name={{ ios, android, web: android }} tintColor={color} size={26} />;
  }
  return TabIcon;
};

// Raised circular center button — opens the Log Record form.
function RecordEntryButton() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      style={styles.recordWrap}
      onPress={() => router.push('/log')}
      accessibilityLabel="Record Entry">
      <View style={styles.recordCircle}>
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          tintColor="#fff"
          size={28}
          resizeMode="center"
          style={styles.recordIcon}
        />
      </View>
      <Text style={styles.recordLabel}>Record Entry</Text>
    </Pressable>
  );
}

export default function TabLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[t.mode].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: icon('house.fill', 'home') }}
      />
      <Tabs.Screen
        name="audit"
        options={{ title: 'Audit Book', tabBarIcon: icon('book.fill', 'menu_book') }}
      />
      <Tabs.Screen
        name="record"
        options={{ title: 'Record Entry', tabBarButton: () => <RecordEntryButton /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: icon('chart.bar.fill', 'bar_chart') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: icon('gearshape.fill', 'settings') }}
      />
    </Tabs>
  );
}

const makeStyles = (t) => StyleSheet.create({
  recordWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -20,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: t.colors.background,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  recordIcon: {
    // SymbolView's intrinsic padding offsets the glyph; fill the circle and
    // let contentMode center it.
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  recordLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: t.colors.primary,
    marginTop: 2,
  },
});
