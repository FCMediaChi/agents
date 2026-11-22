// pipeline-app/server/src/ai.ts
//
// The one and only place this app talks to a language model.
//
// Scope: prose only. Site findings, scores and metric numbers are computed by
// our own code in pitchAnalyzer.ts / caseStudyEngine.ts and are never delegated
// to the model. This module just turns an already-computed set of facts into
// sentences.
//
// Contract: `writeText()` NEVER throws. Any failure (no key, HTTP error, bad
// payload, empty completion, 20s timeout, network error) returns null, and the
// caller falls back to its deterministic template output.

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/** Model used for prose. */
export const AI_MODEL = 'gpt-6.2-sol';

/** Hard ceiling on a single prose call. */
export const AI_TIMEOUT_MS = 20_000;

/** gpt-6.2-sol rejects `max_tokens`; it requires `max_completion_tokens`. */
export const AI_MAX_COMPLETION_TOKENS = 1200;

/** Injectable writer so tests can exercise the fallback path without a network. */
export type TextWriter = (prompt: string) => Promise<string | null>;

/**
 * Ask the model to write `prompt` as plain text.
 * Returns the trimmed completion, or null on any error at all.
 */
export async function writeText(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !prompt || !prompt.trim()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_completion_tokens: AI_MAX_COMPLETION_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;

    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    // Timeout, DNS, TLS, JSON parse, whatever — the caller falls back.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call a writer and swallow anything it throws — the fallback path must never
 * break a generation, even if a writer misbehaves.
 */
export async function safeWrite(writer: TextWriter, prompt: string): Promise<string | null> {
  try {
    return await writer(prompt);
  } catch {
    return null;
  }
}

/**
 * Extract a JSON object from a model reply (tolerates ```json fences and
 * surrounding prose). Returns null when the reply isn't a JSON object.
 */
export function parseJsonObject(text: string | null): Record<string, unknown> | null {
  if (!text) return null;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Read a required non-empty string field from a parsed model reply. */
export function readProseField(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null;
  const value = obj[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
