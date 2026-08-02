// Email service for auth flows.
// Sends email via a local helper. Falls back to clear console logging.
// In production, swap with a real email provider (SendGrid, SES, etc.).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMAIL_LOG_PATH = path.resolve(__dirname, '../../.data/sent-emails.jsonl');

interface EmailRecord {
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

function ensureLogDir(): void {
  const dir = path.dirname(EMAIL_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Send an email. Falls back to writing to a log file + console. */
export async function sendAuthEmail(to: string, subject: string, body: string): Promise<void> {
  const record: EmailRecord = {
    to,
    subject,
    body,
    sentAt: new Date().toISOString(),
  };

  ensureLogDir();

  // Append to email log
  fs.appendFileSync(EMAIL_LOG_PATH, JSON.stringify(record) + '\n');

  // Log clearly for visibility
  console.log('══════════════════════════════════════════');
  console.log(`[EMAIL] To: ${to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body:\n${body}`);
  console.log('══════════════════════════════════════════');
}
