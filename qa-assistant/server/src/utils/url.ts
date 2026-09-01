// Website URLs are untrusted user input. We allow only http/https and reject
// non-web schemes plus localhost/private/internal hosts (SSRF guard for any
// future server-side fetching).

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /\.local$/i,
  /\.internal$/i,
];

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateWebsiteUrl(raw: string): UrlValidationResult {
  const value = (raw || '').trim();
  if (!value) return { valid: true }; // optional field

  if (value.length > 2048) {
    return { valid: false, reason: 'URL is too long' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { valid: false, reason: 'Enter a valid website URL (include http:// or https://)' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only http:// and https:// URLs are allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: 'This URL cannot be used. Please enter a public website URL.' };
    }
  }

  return { valid: true };
}
