// In-memory rate limiting for login attempts.
// Tracks by IP and by email independently.

interface RateLimitEntry {
  attempts: number;
  blockedUntil: number | null;
  firstAttempt: number; // timestamp of first attempt in the window
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const ipMap = new Map<string, RateLimitEntry>();
const emailMap = new Map<string, RateLimitEntry>();

function getOrCreate(map: Map<string, RateLimitEntry>, key: string): RateLimitEntry {
  const entry = map.get(key);
  if (entry) return entry;
  const fresh: RateLimitEntry = { attempts: 0, blockedUntil: null, firstAttempt: Date.now() };
  map.set(key, fresh);
  return fresh;
}

function resetEntry(entry: RateLimitEntry): void {
  entry.attempts = 0;
  entry.blockedUntil = null;
  entry.firstAttempt = Date.now();
}

/** Returns null if allowed, or a human-readable remaining-time string if blocked. */
export function checkRateLimit(ip: string, email: string): string | null {
  const now = Date.now();
  const ipEntry = getOrCreate(ipMap, ip);
  const emailEntry = getOrCreate(emailMap, email);

  // If either is in a block period
  for (const entry of [ipEntry, emailEntry]) {
    if (entry.blockedUntil && now < entry.blockedUntil) {
      const remaining = Math.ceil((entry.blockedUntil - now) / 60_000);
      return remaining > 1 ? `${remaining} minutes` : '1 minute';
    }
    // Clear stale block
    if (entry.blockedUntil && now >= entry.blockedUntil) {
      resetEntry(entry);
    }
  }

  // Reset window if expired
  for (const entry of [ipEntry, emailEntry]) {
    if (now - entry.firstAttempt > WINDOW_MS) {
      resetEntry(entry);
    }
  }

  return null; // allowed
}

/** Record a failed attempt. Returns a block message if threshold was just crossed. */
export function recordFailedAttempt(ip: string, email: string): string | null {
  const now = Date.now();
  const ipEntry = getOrCreate(ipMap, ip);
  const emailEntry = getOrCreate(emailMap, email);

  ipEntry.attempts++;
  emailEntry.attempts++;

  if (ipEntry.attempts >= MAX_ATTEMPTS) {
    ipEntry.blockedUntil = now + BLOCK_DURATION_MS;
    emailEntry.blockedUntil = now + BLOCK_DURATION_MS;
    const minutes = Math.ceil(BLOCK_DURATION_MS / 60_000);
    return `${minutes} minutes`;
  }

  if (emailEntry.attempts >= MAX_ATTEMPTS) {
    ipEntry.blockedUntil = now + BLOCK_DURATION_MS;
    emailEntry.blockedUntil = now + BLOCK_DURATION_MS;
    const minutes = Math.ceil(BLOCK_DURATION_MS / 60_000);
    return `${minutes} minutes`;
  }

  return null;
}

/** Clear rate-limit state for a successfully authenticated login. */
export function clearRateLimit(ip: string, email: string): void {
  ipMap.delete(ip);
  emailMap.delete(email);
}
