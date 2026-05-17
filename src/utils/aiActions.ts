import { useScheduleStore, TimeBlock, getTodayBlocks, getBlocksForDay, DayOfWeek } from '../store/scheduleStore';

export type ActionType = 'NONE' | 'CREATE_BLOCK';

export interface AIAction {
  type: ActionType;
  data?: Record<string, any>;
  needs?: string[];
}

export interface ParsedAIResponse {
  message: string;
  action?: AIAction;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function extractJSON(raw: string): string | null {
  // Strip markdown fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Find first top-level JSON object
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1); }
  }
  return null;
}

export function parseAIResponse(raw: string): ParsedAIResponse {
  const jsonStr = extractJSON(raw);
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed.message === 'string') {
        return { message: parsed.message, action: parsed.action };
      }
    } catch {}
  }
  // Plain text fallback — strip any JSON remnants
  const stripped = raw.replace(/\{[\s\S]*\}/g, '').trim();
  return { message: stripped || raw };
}

export function executeAction(action: AIAction): string | null {
  if (!action || action.type === 'NONE') return null;
  if (action.needs && action.needs.length > 0) return null;
  const d = action.data ?? {};

  if (action.type === 'CREATE_BLOCK') {
    if (!d.title) return null;
    useScheduleStore.getState().addBlock({
      title: String(d.title),
      description: '',
      category: String(d.category ?? 'personal'),
      daysOfWeek: Array.isArray(d.daysOfWeek) ? d.daysOfWeek : [1, 2, 3, 4, 5],
      startTime: String(d.startTime ?? '09:00'),
      endTime: String(d.endTime ?? '10:00'),
      isFixed: false,
      reminder: false,
      weight: 2,
    });
    const days = (Array.isArray(d.daysOfWeek) ? d.daysOfWeek : [1, 2, 3, 4, 5])
      .sort((a: number, b: number) => a - b)
      .map((i: number) => DAY_SHORT[i])
      .join(', ');
    return `"${d.title}" added · ${days} · ${d.startTime ?? '09:00'}–${d.endTime ?? '10:00'}`;
  }

  return null;
}

function formatBlocks(blocks: TimeBlock[]): string {
  if (!blocks.length) return 'None';
  return blocks.map((b) => `  • ${b.title} (${b.category}) ${b.startTime}–${b.endTime}`).join('\n');
}

export function buildSystemPrompt(userName: string): string {
  const now = new Date();
  const blocks = useScheduleStore.getState().blocks;

  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const todayDay = now.getDay() as DayOfWeek;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const todayBlocks = getTodayBlocks(blocks);
  const remainingToday = todayBlocks.filter((b) => b.startTime > hhmm);

  const upcoming: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const day = ((todayDay + i) % 7) as DayOfWeek;
    const db = getBlocksForDay(blocks, day);
    if (db.length) upcoming.push(`  ${DAY_NAMES[day]}: ${db.map((b) => `${b.title} ${b.startTime}–${b.endTime}`).join(', ')}`);
  }

  const firstName = userName ? userName.split(' ')[0] : '';
  const nameStr = firstName ? `You are talking to ${firstName}.` : '';

  return `You are Meridian, a personal AI assistant built into ${firstName || 'the user'}'s productivity app. ${nameStr}
Be warm, direct, and natural — like a smart friend, not a corporate chatbot. Use ${firstName ? `${firstName}'s` : 'their'} name occasionally but not in every message. Keep replies short.

TODAY: ${todayStr}, ${timeStr}

SCHEDULE TODAY:
${formatBlocks(todayBlocks)}

STILL TO GO TODAY:
${formatBlocks(remainingToday)}

COMING UP (next 3 days):
${upcoming.length ? upcoming.join('\n') : '  Nothing scheduled'}

══════════════════════════════
ALWAYS respond with JSON — no markdown, no extra text outside the JSON:
{"message":"...","action":{"type":"...","data":{...},"needs":[...]}}

ACTION TYPES:
• NONE — general chat, questions, schedule info
• CREATE_BLOCK — add a new schedule block

CREATE_BLOCK:
  Required: title, daysOfWeek (int[] 0=Sun…6=Sat), startTime ("HH:MM"), endTime ("HH:MM")
  Optional with defaults: category → infer from title context, defaults to "personal"
  NEVER ask for: description, reminder, isFixed — set automatically

  Category inference (use this, don't ask):
  workout/gym/training/exercise/run → "training"
  work/coding/study/deep work/meeting → "work"
  meal/lunch/dinner/breakfast/food → "nutrition"
  sleep/rest/nap/wind down → "rest"
  reading/course/learn/book → "learning"
  anything else → "personal"

MISSING FIELDS — your message must ask naturally and specifically:
  Missing days+times → "When should [title] happen? Which days and what time?"
  Missing just times → "What time does [title] start and end?"
  Missing just days → "Which days is [title] for?"
  Missing just title → "What would you like to call it?"
  NEVER say "I need more information" without stating exactly what

When needs[] is empty → execute the action. Confirm warmly in message, e.g.:
  "Done! Morning Run is set for weekdays at 7–8am. 🏃"

EXAMPLES:
User: "add a block called deep work on weekdays 9 to 12"
→ {"message":"Done! Deep Work is blocked out every weekday from 9am–12pm. Good thinking keeping mornings protected.","action":{"type":"CREATE_BLOCK","data":{"title":"Deep Work","category":"work","daysOfWeek":[1,2,3,4,5],"startTime":"09:00","endTime":"12:00"},"needs":[]}}

User: "create a block called abc"
→ {"message":"When should abc happen? Which days and what time?","action":{"type":"CREATE_BLOCK","data":{"title":"abc","category":"personal"},"needs":["daysOfWeek","startTime","endTime"]}}

User: "weekdays 6 to 7am"  (following up the above)
→ {"message":"Done! abc is set for weekdays 6–7am.","action":{"type":"CREATE_BLOCK","data":{"title":"abc","category":"personal","daysOfWeek":[1,2,3,4,5],"startTime":"06:00","endTime":"07:00"},"needs":[]}}`;
}

export function getActionLabel(action: AIAction | undefined): string | null {
  if (!action || action.type === 'NONE') return null;
  const d = action.data ?? {};
  const needs = action.needs ?? [];
  if (action.type === 'CREATE_BLOCK') {
    const name = d.title ? `"${d.title}"` : 'new block';
    return needs.length ? `Creating block ${name}…` : `Block ${name} ready`;
  }
  return null;
}
