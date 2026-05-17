import { TOOL_DEFINITIONS, TOOL_HANDLERS } from './tools/index';

// ── Provider config ──────────────────────────────────────────────
// Adding a new provider later = add to this union and a case in callProvider()

export interface GroqConfig {
  provider: 'groq';
  apiKey: string;
}

export type ProviderConfig = GroqConfig;

// ── Public types ─────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SendResult {
  text: string;
  toolsUsed: string[];
  actionResult?: string; // human-readable confirmation of any writes (e.g. "Gym block added")
}

// ── Constants ────────────────────────────────────────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_TOOL_ITERATIONS = 6;

// ── System prompt ────────────────────────────────────────────────

function buildSystemPrompt(userName: string): string {
  const now = new Date();
  const firstName = userName ? userName.split(' ')[0] : '';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return `You are Meridian, a personal AI assistant.${firstName ? ` You're talking to ${firstName}.` : ''}
Today is ${dateStr} at ${timeStr}. Be warm, direct, and concise — like a smart friend, not a corporate chatbot.
Use your tools to answer questions about schedule, calendar events, and to create blocks or events.
Never fabricate schedule or event data — call the relevant tool first.
When creating blocks or events, confirm details with the user before calling the create tool unless they have already provided everything needed.`;
}

// ── Groq API call ────────────────────────────────────────────────

async function callGroq(messages: any[], groqKey: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    const msg = (err.message ?? '').toLowerCase();
    if (msg.includes('network') || msg.includes('abort') || msg.includes('refused') || msg.includes('timeout') || msg.includes('fetch')) {
      throw new Error('api.groq.com is unreachable. Check your connection or try on a different network.');
    }
    throw err;
  }
  clearTimeout(timer);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errMsg = body?.error?.message ?? '';
    if (res.status === 401) throw new Error('Invalid Groq API key — check Settings.');
    if (res.status === 429) throw new Error('Groq rate limit hit — wait a moment and try again.');
    throw new Error(errMsg || `Groq error ${res.status}`);
  }
  return res.json();
}

// ── Tool-use loop ────────────────────────────────────────────────

export async function sendMessageWithTools(
  history: ChatMessage[],
  userName: string,
  config: ProviderConfig,
): Promise<SendResult> {
  if (!config.apiKey) throw new Error('No Groq API key — add one in Browse → Settings.');

  const system = buildSystemPrompt(userName);
  const toolsUsed: string[] = [];
  let actionResult: string | undefined;

  // Working message array — includes tool role messages not visible in the UI
  const messages: any[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const data = await callGroq([{ role: 'system', content: system }, ...messages], config.apiKey);
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) throw new Error('Empty response from Groq — try again.');

    const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;

    // No tool calls or model chose to stop → final text response
    if (!hasToolCalls || choice?.finish_reason === 'stop') {
      return { text: msg.content ?? '', toolsUsed, actionResult };
    }

    // Execute all tool calls in this turn in order
    messages.push(msg); // assistant message with tool_calls

    for (const tc of msg.tool_calls) {
      const name: string = tc.function?.name ?? '';
      let args: Record<string, any> = {};
      try { args = JSON.parse(tc.function?.arguments ?? '{}'); } catch {}

      const handler = TOOL_HANDLERS[name];
      let result: any;
      try {
        result = handler ? await handler(args) : { error: `Unknown tool: ${name}` };
      } catch (err: any) {
        result = { error: err.message ?? 'Tool execution failed' };
      }

      toolsUsed.push(name);

      // Capture human-readable write confirmations
      if (result?.success && result?.message && (name === 'create_schedule_block' || name === 'create_calendar_event')) {
        actionResult = result.message;
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Exceeded max iterations — ask for a final summary without tools
  const finalData = await callGroq(
    [
      { role: 'system', content: system },
      ...messages,
      { role: 'user', content: 'Please give a short summary of what you found.' },
    ],
    config.apiKey,
  );
  return {
    text: finalData.choices?.[0]?.message?.content ?? "Sorry, I couldn't complete that request.",
    toolsUsed,
    actionResult,
  };
}
