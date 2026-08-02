// Email service for auth flows.
// Sends via Resend API. Falls back to console + file logging on failure.
import fs from 'fs';
import path from 'path';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_API_URL = 'https://api.resend.com/emails';
const EMAIL_LOG_PATH = path.resolve('.data', 'sent-emails.jsonl');

function ensureLogDir(): void {
  const dir = path.dirname(EMAIL_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendToLog(entry: Record<string, unknown>): void {
  try {
    ensureLogDir();
    fs.appendFileSync(EMAIL_LOG_PATH, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error(`[EMAIL] Failed to write to email log: ${err}`);
  }
}

/** Send an email via Resend. Falls back to console + file logging. */
export async function sendAuthEmail(to: string, subject: string, body: string): Promise<void> {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Nuria AI <noreply@firstcreationmedia.com>',
        to: [to],
        subject,
        text: body,
      }),
    });

    if (response.ok) {
      console.log(`[EMAIL] Sent to ${to}: "${subject}"`);
      appendToLog({ to, subject, status: 'sent', timestamp: new Date().toISOString() });
    } else {
      const err = await response.text();
      console.error(`[EMAIL] Resend API error (${response.status}): ${err}`);
      logFallback(to, subject, body);
    }
  } catch (error) {
    console.error(`[EMAIL] Resend API unreachable: ${error}`);
    logFallback(to, subject, body);
  }
}

function logFallback(to: string, subject: string, body: string): void {
  console.log('══════════════════════════════════════════');
  console.log(`[EMAIL FALLBACK] To: ${to}`);
  console.log(`[EMAIL FALLBACK] Subject: ${subject}`);
  console.log(`[EMAIL FALLBACK] Body:\n${body}`);
  console.log('══════════════════════════════════════════');

  appendToLog({ to, subject, body, status: 'fallback', timestamp: new Date().toISOString() });
}
