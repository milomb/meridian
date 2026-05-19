import { useScheduleStore, getUpcomingBlocks } from '../../store/scheduleStore';

export const getUpcomingBlocksTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'get_upcoming_blocks',
      description: "Returns the next schedule blocks remaining in today's plan after the current time.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  handler: async (_args: Record<string, any>) => {
    const blocks = useScheduleStore.getState().blocks;
    const upcoming = getUpcomingBlocks(blocks, 3);
    return {
      upcoming: upcoming.map((b) => ({
        title: b.title,
        category: b.category,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
      count: upcoming.length,
    };
  },
};
