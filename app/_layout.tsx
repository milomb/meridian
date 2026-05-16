import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { requestNotificationPermissions, scheduleBlockReminders } from '../src/utils/notifications';
import { useScheduleStore } from '../src/store/scheduleStore';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  const { blocks, load } = useScheduleStore();

  useEffect(() => {
    load().then(async () => {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleBlockReminders(useScheduleStore.getState().blocks);
      }
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0C0B' },
});
