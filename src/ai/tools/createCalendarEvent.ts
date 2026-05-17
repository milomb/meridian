import * as Calendar from 'expo-calendar';
import { useLocalEventStore } from '../../store/localEventStore';

export const createCalendarEventTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'create_calendar_event',
      description:
        'Creates a calendar event. Use destination "meridian" for a local-only event (stored on device, not synced) or "apple" to add to the user\'s Apple Calendar.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          start: {
            type: 'string',
            description: 'ISO 8601 datetime e.g. "2024-06-15T14:00:00" or date-only "2024-06-15" for all-day',
          },
          end: {
            type: 'string',
            description: 'ISO 8601 datetime or date-only for all-day',
          },
          destination: {
            type: 'string',
            enum: ['apple', 'meridian'],
            description: '"apple" syncs to Apple Calendar, "meridian" stays local to this app only',
          },
          is_all_day: { type: 'boolean', description: 'Whether this is an all-day event' },
          notes: { type: 'string', description: 'Optional notes or description' },
        },
        required: ['title', 'start', 'end', 'destination'],
      },
    },
  },
  handler: async (args: {
    title: string;
    start: string;
    end: string;
    destination: 'apple' | 'meridian';
    is_all_day?: boolean;
    notes?: string;
  }) => {
    const isAllDay = args.is_all_day ?? args.start.length === 10;
    const date = args.start.slice(0, 10);

    if (args.destination === 'meridian') {
      const startTime = isAllDay ? '' : args.start.slice(11, 16);
      const endTime = isAllDay ? '' : args.end.slice(11, 16);
      useLocalEventStore.getState().addEvent({
        title: args.title,
        date,
        startTime,
        endTime,
        isAllDay,
        color: '#5B8FD4',
        notes: args.notes ?? '',
      });
      return { success: true, message: `"${args.title}" added to Meridian on ${date}` };
    }

    // Apple Calendar
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, error: 'Calendar permission denied — user needs to allow access in Settings.' };
      }
      const defaultCal = await Calendar.getDefaultCalendarAsync();
      if (!defaultCal?.id) {
        return { success: false, error: 'No default Apple Calendar found on this device.' };
      }
      await Calendar.createEventAsync(defaultCal.id, {
        title: args.title,
        startDate: new Date(args.start),
        endDate: new Date(args.end),
        allDay: isAllDay,
        notes: args.notes,
      });
      return { success: true, message: `"${args.title}" added to Apple Calendar on ${date}` };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Failed to create Apple Calendar event' };
    }
  },
};
