// Email service for Blueprint auth flows.
//
// Provider: Resend — the same integration and the same RESEND_API_KEY env var the
// monolith uses (owner decision, 2026-10-25: keep Resend, no provider switch).
// When no key is configured (dev/test, previews) the email is not sent: it is
// logged to the console and appended to `.data/sent-emails.jsonl`, so every
// verification/reset flow stays fully exercisable without a mail account.
import fs from 'fs';
import path from 'path';
import { config, isEmailConfigured } from './config.js';

const RESEND_API_URL = 'https://api.resend.com/emails';
const EMAIL_LOG_PATH = path.resolve('.data', 'sent-emails.jsonl');

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailResult {
  delivered: boolean;
  transport: 'resend' | 'log';
}

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

/**
 * Build an absolute link for an email.
 * Priority: PUBLIC_BASE_URL/APP_BASE_URL → the origin of the current request →
 * a relative path (still useful in logs and dev responses).
 */
export function buildAppLink(pathAndQuery: string, requestOrigin?: string): string {
  const base = (config.publicBaseUrl || requestOrigin || '').replace(/\/$/, '');
  const suffix = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `${base}${suffix}`;
}

/** Send an email via Resend, falling back to console + file logging. */
export async function sendEmail(email: OutboundEmail): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    logFallback(email, 'RESEND_API_KEY not set');
    return { delivered: false, transport: 'log' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
      }),
    });

    if (response.ok) {
      console.log(`[EMAIL] Sent to ${email.to}: "${email.subject}"`);
      appendToLog({ to: email.to, subject: email.subject, status: 'sent', timestamp: new Date().toISOString() });
      return { delivered: true, transport: 'resend' };
    }

    const err = await response.text();
    console.error(`[EMAIL] Resend API error (${response.status}): ${err}`);
    logFallback(email, `Resend error ${response.status}`);
    return { delivered: false, transport: 'log' };
  } catch (error) {
    console.error(`[EMAIL] Resend API unreachable: ${error}`);
    logFallback(email, 'Resend unreachable');
    return { delivered: false, transport: 'log' };
  }
}

function logFallback(email: OutboundEmail, reason: string): void {
  console.log('══════════════════════════════════════════');
  console.log(`[EMAIL:LOGGED] ${reason} — email not actually sent`);
  console.log(`[EMAIL:LOGGED] To: ${email.to}`);
  console.log(`[EMAIL:LOGGED] Subject: ${email.subject}`);
  console.log(`[EMAIL:LOGGED] Body:\n${email.text}`);
  console.log('══════════════════════════════════════════');

  appendToLog({
    to: email.to,
    subject: email.subject,
    body: email.text,
    status: 'logged',
    reason,
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Blueprint-specific templates
// ---------------------------------------------------------------------------

export async function sendVerificationEmail(to: string, verificationLink: string): Promise<EmailResult> {
  const subject = 'Verify your Nuria Website Blueprint account';
  const text = [
    'Welcome to Nuria Website Blueprint!',
    '',
    'Please verify your email address by opening the link below:',
    '',
    verificationLink,
    '',
    'This link is unique to your account. If you did not create this account, you can safely ignore this email.',
    '',
    '— The Nuria AI Team',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;line-height:1.55">
      <h2 style="margin:0 0 12px;color:#4551D3">Verify your email</h2>
      <p>Welcome to <strong>Nuria Website Blueprint</strong>! Please confirm your email address to activate your account.</p>
      <p style="margin:24px 0">
        <a href="${verificationLink}" style="background:#1A9EF2;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Verify my email</a>
      </p>
      <p style="font-size:13px;color:#64748b">If the button does not work, paste this link into your browser:<br />${verificationLink}</p>
      <p style="font-size:13px;color:#64748b">If you did not create this account, you can safely ignore this email.</p>
    </div>`;

  return sendEmail({ to, subject, text, html });
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  expiresInMinutes: number,
): Promise<EmailResult> {
  const subject = 'Reset your Nuria Website Blueprint password';
  const text = [
    'We received a request to reset the password for your Nuria Website Blueprint account.',
    '',
    'Choose a new password by opening the link below:',
    '',
    resetLink,
    '',
    `This link expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}.`,
    '',
    'If you did not request a password reset, you can safely ignore this email — your password will not change.',
    '',
    '— The Nuria AI Team',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;line-height:1.55">
      <h2 style="margin:0 0 12px;color:#4551D3">Reset your password</h2>
      <p>We received a request to reset the password for your Nuria Website Blueprint account.</p>
      <p style="margin:24px 0">
        <a href="${resetLink}" style="background:#1A9EF2;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Choose a new password</a>
      </p>
      <p style="font-size:13px;color:#64748b">This link expires in ${expiresInMinutes} minutes. If you did not request a reset, you can safely ignore this email.</p>
    </div>`;

  return sendEmail({ to, subject, text, html });
}
