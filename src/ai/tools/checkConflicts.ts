import * as Calendar from 'expo-calendar';
import { useScheduleStore, getBlocksForDay, DayOfWeek } from '../../store/scheduleStore';
import { useLocalEventStore } from '../../store/localEventStore';

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtMins(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function overlaps(aS: number, aE: number, bS: number, bE: number): boolean {
  return aS < bE && bS < aE;
}

export const checkConflictsTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'check_conflicts',
      description:
        'Checks for time conflicts (overlapping events or schedule blocks) on a specific date. Returns all scheduled items sorted by time and flags any overlaps.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date to check in YYYY-MM-DD format' },
        },
        required: ['date'],
      },
    },
  },
  handler: async (args: { date: string }) => {
    const date = new Date(`${args.date}T00:00:00`);
    const dow = date.getDay() as DayOfWeek;

    type Item = { title: string; startMins: number; endMins: number; source: string };
    const items: Item[] = [];

    // Schedule blocks
    for (const b of getBlocksForDay(useScheduleStore.getState().blocks, dow)) {
      items.push({ title: b.title, startMins: toMins(b.startTime), endMins: toMins(b.endTime), source: 'block' });
    }

    // Local events
    for (const e of useLocalEventStore.getState().events.filter((e) => e.date === args.date && !e.isAllDay)) {
      items.push({ title: e.title, startMins: toMins(e.startTime), endMins: toMins(e.endTime), source: 'meridian' });
    }

    // Apple Calendar
    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      if (status === 'granted') {
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const start = new Date(`${args.date}T00:00:00`);
        const end = new Date(`${args.date}T23:59:59`);
        const events = await Calendar.getEventsAsync(cals.map((c) => c.id), start, end);
        for (const e of events.filter((e) => !e.allDay)) {
          const s = new Date(e.startDate);
          const en = new Date(e.endDate);
          items.push({ title: e.title, startMins: s.getHours() * 60 + s.getMinutes(), endMins: en.getHours() * 60 + en.getMinutes(), source: 'apple' });
        }
      }
    } catch {}

    items.sort((a, b) => a.startMins - b.startMins);

    const conflicts: Array<{ a: string; b: string }> = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (overlaps(items[i].startMins, items[i].endMins, items[j].startMins, items[j].endMins)) {
          conflicts.push({ a: items[i].title, b: items[j].title });
        }
      }
    }

    return {
      date: args.date,
      items: items.map((i) => ({ title: i.title, start: fmtMins(i.startMins), end: fmtMins(i.endMins), source: i.source })),
      conflicts,
      hasConflicts: conflicts.length > 0,
    };
  },
};
