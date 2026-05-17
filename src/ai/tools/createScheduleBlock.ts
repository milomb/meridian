import { useScheduleStore, DayOfWeek } from '../../store/scheduleStore';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_KEYWORDS: Array<[string, string]> = [
  ['workout', 'training'], ['gym', 'training'], ['training', 'training'],
  ['exercise', 'training'], ['run', 'training'], ['sprint', 'training'],
  ['work', 'work'], ['coding', 'work'], ['study', 'work'], ['meeting', 'work'], ['deep', 'work'],
  ['meal', 'nutrition'], ['lunch', 'nutrition'], ['dinner', 'nutrition'], ['breakfast', 'nutrition'],
  ['sleep', 'rest'], ['rest', 'rest'], ['nap', 'rest'], ['wind', 'rest'],
  ['reading', 'learning'], ['course', 'learning'], ['learn', 'learning'], ['book', 'learning'],
];

function inferCategory(title: string, given?: string): string {
  if (given) return given;
  const lower = title.toLowerCase();
  for (const [kw, cat] of CATEGORY_KEYWORDS) {
    if (lower.includes(kw)) return cat;
  }
  return 'personal';
}

export const createScheduleBlockTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'create_schedule_block',
      description:
        'Creates a new recurring schedule block. Only call this when you have the title, days, and times — ask the user for any missing details before calling.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Name of the block' },
          days_of_week: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 6 },
            description: 'Days this block repeats: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat',
          },
          start_time: { type: 'string', description: 'Start time in HH:MM (24h)' },
          end_time: { type: 'string', description: 'End time in HH:MM (24h)' },
          category: {
            type: 'string',
            enum: ['training', 'work', 'nutrition', 'rest', 'learning', 'personal'],
            description: 'Infer from title if not provided',
          },
        },
        required: ['title', 'days_of_week', 'start_time', 'end_time'],
      },
    },
  },
  handler: async (args: {
    title: string;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    category?: string;
  }) => {
    const category = inferCategory(args.title, args.category);
    useScheduleStore.getState().addBlock({
      title: args.title,
      description: '',
      category,
      daysOfWeek: args.days_of_week as DayOfWeek[],
      startTime: args.start_time,
      endTime: args.end_time,
      isFixed: false,
      reminder: false,
    });
    const days = [...args.days_of_week].sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(', ');
    return { success: true, message: `"${args.title}" added · ${days} · ${args.start_time}–${args.end_time}` };
  },
};
