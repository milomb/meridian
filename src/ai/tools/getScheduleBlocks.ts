import { useScheduleStore, getBlocksForDay, DayOfWeek } from '../../store/scheduleStore';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getScheduleBlocksTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'get_schedule_blocks',
      description:
        'Returns all recurring schedule blocks for a specific day of the week. Use this to describe what a given day looks like in the user\'s routine.',
      parameters: {
        type: 'object',
        properties: {
          day: {
            type: 'integer',
            description: 'Day of week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday',
            minimum: 0,
            maximum: 6,
          },
        },
        required: ['day'],
      },
    },
  },
  handler: async (args: { day: number }) => {
    const blocks = useScheduleStore.getState().blocks;
    const dayBlocks = getBlocksForDay(blocks, args.day as DayOfWeek);
    return {
      day: DAY_NAMES[args.day],
      blocks: dayBlocks.map((b) => ({
        title: b.title,
        category: b.category,
        startTime: b.startTime,
        endTime: b.endTime,
        isFixed: b.isFixed,
      })),
      count: dayBlocks.length,
    };
  },
};
