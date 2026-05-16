import { Tabs } from 'expo-router';
import { colors } from '../../src/theme/colors';

const TAB_ICON: Record<string, string> = {
  index: '◉',
  schedule: '⏱',
  habits: '✓',
  calendar: '◻',
  notes: '✎',
  chat: '◈',
};

const TAB_LABEL: Record<string, string> = {
  index: 'Today',
  schedule: 'Schedule',
  habits: 'Habits',
  calendar: 'Calendar',
  notes: 'Notes',
  chat: 'AI Chat',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabel: TAB_LABEL[route.name] ?? route.name,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color }) => null,
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="notes" />
      <Tabs.Screen name="chat" />
    </Tabs>
  );
}
