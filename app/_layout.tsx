import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { requestNotificationPermissions, scheduleBlockReminders } from '../src/utils/notifications';
import { useScheduleStore } from '../src/store/scheduleStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useMoodStore } from '../src/store/moodStore';
import { useColors } from '../src/theme/colors';

export default function RootLayout() {
  const { blocks, load } = useScheduleStore();
  const { load: loadSettings } = useSettingsStore();
  const { load: loadMood } = useMoodStore();
  const c = useColors();

  useEffect(() => {
    loadSettings().then(() => {
      load().then(async () => {
        const granted = await requestNotificationPermissions();
        if (granted) {
          await scheduleBlockReminders(useScheduleStore.getState().blocks);
        }
      });
      loadMood();
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={c.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
