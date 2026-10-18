import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

// Global crash boundary for the root layout. Catches render-time errors anywhere
// in the tree and offers a reset instead of a hard crash to the OS.
class ErrorBoundaryInner extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Hook a crash reporter (Sentry etc.) here when ready.
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const styles = makeStyles(this.props.t);
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message} numberOfLines={4}>
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </Text>
        <Pressable style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
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
    fontSize: 20,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: t.spacing(2),
  },
  message: {
    fontSize: 14,
    color: t.colors.textMuted,
    textAlign: 'center',
    marginBottom: t.spacing(6),
  },
  button: {
    backgroundColor: t.colors.primary,
    paddingHorizontal: t.spacing(6),
    paddingVertical: t.spacing(3),
    borderRadius: t.radius.md,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

// Class components can't call hooks, so the theme is resolved here and passed
// down as a prop.
export function ErrorBoundary(props) {
  const t = useTheme();
  return <ErrorBoundaryInner {...props} t={t} />;
}

export default ErrorBoundary;
