import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Library',
        }}
      />
      <Tabs.Screen
        name="storage"
        options={{
          title: 'Storage',
        }}
      />
      <Tabs.Screen
        name="patcher"
        options={{
          title: 'Patcher',
        }}
      />
    </Tabs>
  );
}
