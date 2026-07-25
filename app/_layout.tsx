import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { initDb } from '../src/db/database';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      try {
        await initDb();
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        if (isMounted) {
          setDbReady(true);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
