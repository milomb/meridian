import Anthropic from '@anthropic-ai/sdk';

export type AIProvider = 'anthropic' | 'groq' | 'ollama';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function isNetworkError(msg: string): boolean {
  const l = msg.toLowerCase();
  return (
    l.includes('network request failed') ||
    l.includes('access denied') ||
    l.includes('network settings') ||
    l.includes('failed to fetch') ||
    l.includes('abort') ||
    l.includes('timeout') ||
    l.includes('connection refused')
  );
}

async function callGroq(
  messages: AIMessage[],
  system: string,
  groqKey: string,
  maxTokens: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (isNetworkError(err.message ?? '')) {
      throw new Error('api.groq.com is blocked on this network.\nTry Ollama (local, VPN-proof) or Anthropic in Settings.');
    }
    throw err;
  }
  clearTimeout(timer);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message ?? '';
    if (res.status === 401) throw new Error('Invalid Groq API key — check Settings.');
    if (res.status === 429) throw new Error('Groq rate limit — wait a moment and retry.');
    throw new Error(msg || `Groq error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callOllama(
  messages: AIMessage[],
  system: string,
  ollamaUrl: string,
  ollamaModel: string,
  maxTokens: number,
): Promise<string> {
  const base = ollamaUrl.replace(/\/$/, '');
  const url = `${base}/v1/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel || 'llama3.2',
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (isNetworkError(err.message ?? '') || (err.message ?? '').includes('refused')) {
      throw new Error(`Cannot reach Ollama at ${base}.\nMake sure "ollama serve" is running and the URL is correct in Settings.`);
    }
    throw err;
  }
  clearTimeout(timer);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Ollama error ${res.status}`);
  }
  const data = await res.json();
  // OpenAI-compatible response
  return data.choices?.[0]?.message?.content ?? '';
}

export async function sendAIMessage(
  messages: AIMessage[],
  system: string,
  provider: AIProvider,
  anthropicKey: string,
  groqKey: string,
  maxTokens = 1024,
  ollamaUrl = '',
  ollamaModel = 'llama3.2',
): Promise<string> {
  if (provider === 'groq') {
    if (!groqKey) throw new Error('No Groq API key — add one in Settings.');
    return callGroq(messages, system, groqKey, maxTokens);
  }

  if (provider === 'ollama') {
    if (!ollamaUrl) throw new Error('No Ollama URL set — add it in Settings.');
    return callOllama(messages, system, ollamaUrl, ollamaModel, maxTokens);
  }

  // Anthropic
  if (!anthropicKey) throw new Error('No Anthropic API key — add one in Settings.');
  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages,
    });
    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  } catch (err: any) {
    if (isNetworkError(err.message ?? '')) {
      throw new Error('api.anthropic.com is blocked on this network.\nTry Ollama (local, VPN-proof) in Settings.');
    }
    throw err;
  }
}
