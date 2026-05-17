import * as Calendar from 'expo-calendar';
import { useLocalEventStore } from '../../store/localEventStore';

export const getCalendarEventsTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'get_calendar_events',
      description:
        'Returns Apple Calendar and Meridian-only local events for a date range. Use this to answer questions about upcoming plans, free time, or what is scheduled on a specific day or week.',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format (inclusive)' },
          end_date: { type: 'string', description: 'End date in YYYY-MM-DD format (inclusive)' },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  handler: async (args: { start_date: string; end_date: string }) => {
    const { start_date, end_date } = args;
    const startDate = new Date(`${start_date}T00:00:00`);
    const endDate = new Date(`${end_date}T23:59:59`);
    const results: any[] = [];

    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      if (status === 'granted') {
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const events = await Calendar.getEventsAsync(cals.map((c) => c.id), startDate, endDate);
        for (const e of events) {
          results.push({
            source: 'apple',
            title: e.title,
            start: e.startDate,
            end: e.endDate,
            isAllDay: e.allDay ?? false,
            calendar: cals.find((c) => c.id === e.calendarId)?.title ?? '',
          });
        }
      } else {
        results.push({ source: 'info', note: 'Apple Calendar access not granted — showing Meridian events only' });
      }
    } catch {}

    const localEvents = useLocalEventStore.getState().events;
    for (const e of localEvents) {
      if (e.date >= start_date && e.date <= end_date) {
        results.push({
          source: 'meridian',
          title: e.title,
          date: e.date,
          startTime: e.isAllDay ? null : e.startTime,
          endTime: e.isAllDay ? null : e.endTime,
          isAllDay: e.isAllDay,
          notes: e.notes || null,
        });
      }
    }

    return { events: results, count: results.length };
  },
};
