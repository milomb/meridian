const PRIMARY_MODEL = 'moonshotai/kimi-k2-instruct';
const FALLBACK_MODEL = 'llama-3.3-70b-versatile';
const MAX_HISTORY = 6; // sliding window: 3 user + 3 assistant turns

export interface JarvisMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UiAction {
  type: 'SKIP_BLOCK' | 'COMPLETE_BLOCK' | 'MOVE_BLOCK_TODAY' | 'MOVE_BLOCK_PERMANENTLY' | 'CREATE_BLOCK' | 'DELETE_BLOCK' | 'UPDATE_BLOCK_OUTCOME' | 'UNRESOLVE_BLOCK' | 'NONE';
  payload: Record<string, any>;
}

export interface JarvisResponse {
  jarvis_speech: string;
  ui_action: UiAction;
}

const FALLBACK_RESPONSE: JarvisResponse = {
  jarvis_speech: "I'm not thinking straight right now — try again.",
  ui_action: { type: 'NONE', payload: {} },
};

function buildSystemPrompt(stateJson: string): string {
  return `You are Jarvis — Meridian's AI chief of staff and performance mentor. You are direct, sharp, and brief. You celebrate wins without being soft about it, and you call out gaps without moralising. You sound like a high-performance coach who actually knows the user, not a chatbot.

The user's full current state is below. Use it to give contextually aware responses.

Key rules:
- When the user asks how a block went or asks about their performance, always check the block's "rating" and "note" fields in today_schedule or yesterday_review.blocks and reference them explicitly (e.g. "you gave it 4/5 — noted: felt strong").
- When deleting a block, use DELETE_BLOCK — never use MOVE as a substitute.
- Block IDs are numeric strings like "1", "2" — always use the id field, not the name.

You always respond in this exact JSON format — no preamble, no markdown, no extra keys:

{
  "jarvis_speech": "Your natural conversational response to the user.",
  "ui_action": {
    "type": "SKIP_BLOCK | COMPLETE_BLOCK | MOVE_BLOCK_TODAY | MOVE_BLOCK_PERMANENTLY | CREATE_BLOCK | NONE",
    "payload": {}
  }
}

Action type definitions:
- SKIP_BLOCK: payload = { block_id }
- COMPLETE_BLOCK: payload = { block_id }
- UNRESOLVE_BLOCK: payload = { block_id } — clears a block's done/skipped status, marking it pending again
- MOVE_BLOCK_TODAY: payload = { block_id, new_time } — moves a block for today only, does not change recurring schedule
- MOVE_BLOCK_PERMANENTLY: payload = { block_id, new_time } — updates the block's recurring default start time
- CREATE_BLOCK: payload = { name, time, duration_minutes, weight (1–3), is_permanent (boolean) }
- DELETE_BLOCK: payload = { block_id } — permanently removes a block from the schedule
- UPDATE_BLOCK_OUTCOME: payload = { block_id, rating (1–5, optional), note (string, optional) } — adds or updates the rating/note on today's resolution; use when the user shares feedback about a block
- NONE: payload = {} — use when no app state change is needed

Current app state:
${stateJson}`;
}

async function callGroqRaw(apiKey: string, model: string, messages: any[]): Promise<any> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 400,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Groq error ${res.status}`);
  }
  return res.json();
}

export async function sendToJarvis(
  apiKey: string,
  history: JarvisMessage[],
  stateJson: string,
): Promise<JarvisResponse> {
  const key = apiKey || (process.env.GROQ_API_KEY ?? '');
  // System prompt is always fresh, never part of the sliding window
  const windowed = history.slice(-MAX_HISTORY);
  const messages = [
    { role: 'system', content: buildSystemPrompt(stateJson) },
    ...windowed,
  ];

  try {
    let data: any;
    try {
      data = await callGroqRaw(key, PRIMARY_MODEL, messages);
    } catch {
      data = await callGroqRaw(key, FALLBACK_MODEL, messages);
    }
    const raw: string = data.choices?.[0]?.message?.content ?? '';
    try {
      return JSON.parse(raw) as JarvisResponse;
    } catch {
      console.log('[Jarvis] JSON parse failed. Raw:', raw);
      return FALLBACK_RESPONSE;
    }
  } catch (err) {
    console.log('[Jarvis] API error:', err);
    return FALLBACK_RESPONSE;
  }
}
