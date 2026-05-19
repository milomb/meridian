import { useScheduleStore, getCurrentBlock } from '../../store/scheduleStore';
import { useSettingsStore } from '../../store/settingsStore';

export const getTodayTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'get_today',
      description:
        'Returns the current date, time, day of week, user name, and the active schedule block (if any). Call this first when answering questions about now or today.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  handler: async (_args: Record<string, any>) => {
    const now = new Date();
    const blocks = useScheduleStore.getState().blocks;
    const { userName } = useSettingsStore.getState();
    const active = getCurrentBlock(blocks);
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      date: now.toISOString().slice(0, 10),
      dayOfWeek: DAY_NAMES[now.getDay()],
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      dateFormatted: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      userName: userName || null,
      activeBlock: active
        ? { title: active.title, category: active.category, startTime: active.startTime, endTime: active.endTime }
        : null,
    };
  },
};
