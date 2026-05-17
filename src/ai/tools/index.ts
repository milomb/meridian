import { getTodayTool } from './getToday';
import { getCalendarEventsTool } from './getCalendarEvents';
import { getScheduleBlocksTool } from './getScheduleBlocks';
import { getUpcomingBlocksTool } from './getUpcomingBlocks';
import { checkConflictsTool } from './checkConflicts';
import { createScheduleBlockTool } from './createScheduleBlock';
import { createCalendarEventTool } from './createCalendarEvent';

const ALL_TOOLS = [
  getTodayTool,
  getCalendarEventsTool,
  getScheduleBlocksTool,
  getUpcomingBlocksTool,
  checkConflictsTool,
  createScheduleBlockTool,
  createCalendarEventTool,
];

// OpenAI-compatible tool definitions array sent to the model
export const TOOL_DEFINITIONS = ALL_TOOLS.map((t) => t.definition);

// Map of tool name → async handler, for executing tool calls from the model
export const TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.definition.function.name, t.handler]),
);
