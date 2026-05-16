import * as Notifications from 'expo-notifications';
import { TimeBlock } from '../store/scheduleStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleBlockReminders(blocks: TimeBlock[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const block of blocks) {
    if (!block.reminder) continue;

    const [h, m] = block.startTime.split(':').map(Number);

    for (const day of block.daysOfWeek) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: block.title,
          body: `Starting now until ${block.endTime}`,
          data: { blockId: block.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo uses 1=Sun
          hour: h,
          minute: m,
        },
      });
    }
  }
}
