import { View, Text, StyleSheet } from 'react-native';

export default function StorageTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Storage / External Manager</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
