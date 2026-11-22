// pipeline-app/server/src/tests/ai.test.ts
//
// Unit tests for the model-writes-prose / code-computes-facts split:
//   - writeText() returns null on every failure mode and never throws
//   - the pitch email and the case-study narrative fall back to the exact
//     template output when the model gives nothing usable
//   - the per-tier monthly AI-generation cap
//
// No network and no OpenAI key: `fetch` is stubbed and every writer is
// injected. Run with: npm run test:ai

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmpDbPath = path.join(os.tmpdir(), `pipeline-ai-test-${crypto.randomUUID()}.sqlite`);
process.env.PIPELINE_DB_PATH = tmpDbPath;
delete process.env.OPENAI_API_KEY;

const { writeText, parseJsonObject, AI_MODEL, AI_TIMEOUT_MS } = await import('../ai.js');
const { initDb, getDb, closeDb } = await import('../db.js');
const { composeEmail } = await import('../pitchAnalyzer.js');
const { generateCaseStudy, buildMetrics } = await import('../caseStudyEngine.js');
const {
  AI_MONTHLY_CAP,
  aiQuotaState,
  consumeAiGeneration,
  capForTier,
  monthlyPeriod,
} = await import('../aiQuota.js');

let passed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${err?.message ?? err}`);
  }
}

// --- fixtures ---------------------------------------------------------------

const realFetch = globalThis.fetch;

function stubFetch(impl: (url: any, init?: any) => Promise<any>): { calls: any[] } {
  const calls: any[] = [];
  globalThis.fetch = (async (url: any, init?: any) => {
    calls.push({ url, init });
    return impl(url, init);
  }) as any;
  return { calls };
}

function restoreFetch(): void {
  globalThis.fetch = realFetch;
}

function jsonResponse(status: number, body: unknown): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const FINDINGS = [
  {
    issue: 'Missing viewport meta tag',
    severity: 'critical' as const,
    why_matters: 'Without viewport, mobile visitors see a broken, zoomed-out layout.',
    fix: 'Add the viewport meta tag.',
  },
  {
    issue: 'No H1 heading found',
    severity: 'critical' as const,
    why_matters: 'H1s signal page topic to search engines.',
    fix: 'Add a single, keyword-focused H1.',
  },
  {
    issue: 'Missing meta description',
    severity: 'warning' as const,
    why_matters: 'Meta descriptions influence click-through rates.',
    fix: 'Write a 150-160 character meta description.',
  },
];

const EMAIL_ARGS = {
  prospectName: 'Dana Ruiz',
  url: 'https://acme-example.com',
  serviceLabel: 'web design',
  agencyName: 'Northline Studio',
  findings: FINDINGS,
};

/** The template output exactly as it shipped before the model was wired in. */
const TEMPLATE_EMAIL = {
  subject: 'Quick audit of acme-example.com — found 3 opportunities to improve',
  body:
    'Hi Dana Ruiz,\n\n' +
    'I took a quick look at https://acme-example.com and noticed 3 things that might be holding back your results. Here are the top issues:\n\n' +
    '• Missing viewport meta tag\n' +
    '• No H1 heading found\n' +
    '\nThese aren\'t just cosmetic — they directly impact how many visitors turn into customers.\n\n' +
    'At Northline Studio, we specialize in web design. We\'ve helped businesses like yours fix these exact problems and see measurable improvements in traffic, leads, and revenue.\n\n' +
    'Would you be open to a 15-minute call this week? I\'ll walk you through the full audit and share specific recommendations — no pitch, just value.\n\n' +
    'Best,\n[Agency Contact Name]\nNorthline Studio',
  signature: 'Northline Studio\nWebsite: [Your Website Here]',
};

const AUDIT = {
  url: 'https://old-acme.example',
  title: 'Acme',
  issues: ['Missing page title', '3 image(s) missing alt text'],
  score: 40,
};

const CASE_INPUT = {
  client_name: 'Acme Co',
  client_url: 'https://acme-example.com',
  old_site_url: 'https://old-acme.example',
  traffic_data: { monthly_visitors_before: 8000, monthly_visitors_after: 24000, bounce_rate_before: 72, bounce_rate_after: 41 },
  revenue_data: { monthly_revenue_before: 12000, monthly_revenue_after: 31000 },
};

const PROSE_JSON = JSON.stringify({
  problem: 'Acme Co had a slow, dated site that lost visitors before they converted.',
  solution: 'We rebuilt the site around a single clear conversion path and a faster stack.',
  results: 'The new site earns far more traffic and revenue than the old one did.',
  executive_summary: 'A full redesign that turned a dated brochure site into a growth channel.',
});

// --- writeText --------------------------------------------------------------

console.log('\nwriteText (never throws, null on any error)');

await test('returns null and makes no request when OPENAI_API_KEY is unset', async () => {
  const { calls } = stubFetch(async () => jsonResponse(200, {}));
  try {
    assert.equal(await writeText('write something'), null);
    assert.equal(calls.length, 0);
  } finally {
    restoreFetch();
  }
});

await test('returns null on a non-2xx response', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  stubFetch(async () => jsonResponse(500, { error: 'boom' }));
  try {
    assert.equal(await writeText('write something'), null);
  } finally {
    restoreFetch();
    delete process.env.OPENAI_API_KEY;
  }
});

await test('returns null when the request throws (network error)', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  stubFetch(async () => {
    throw new Error('ECONNRESET');
  });
  try {
    assert.equal(await writeText('write something'), null);
  } finally {
    restoreFetch();
    delete process.env.OPENAI_API_KEY;
  }
});

await test('returns null when the request is aborted (20s timeout path)', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  stubFetch(async () => {
    throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
  });
  try {
    assert.equal(await writeText('write something'), null);
    assert.equal(AI_TIMEOUT_MS, 20_000);
  } finally {
    restoreFetch();
    delete process.env.OPENAI_API_KEY;
  }
});

await test('returns null on an empty or malformed completion', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  stubFetch(async () => jsonResponse(200, { choices: [{ message: { content: '   ' } }] }));
  try {
    assert.equal(await writeText('write something'), null);
  } finally {
    restoreFetch();
    delete process.env.OPENAI_API_KEY;
  }
});

await test('sends model + max_completion_tokens (never max_tokens) and returns the text', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  const { calls } = stubFetch(async () =>
    jsonResponse(200, { choices: [{ message: { content: '  Hello there.  ' } }] })
  );
  try {
    assert.equal(await writeText('say hello'), 'Hello there.');
    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, AI_MODEL);
    assert.equal(body.model, 'gpt-6.2-sol');
    assert.ok(typeof body.max_completion_tokens === 'number' && body.max_completion_tokens > 0);
    assert.equal('max_tokens' in body, false);
    assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-test');
  } finally {
    restoreFetch();
    delete process.env.OPENAI_API_KEY;
  }
});

await test('parseJsonObject tolerates code fences and rejects non-JSON', () => {
  assert.deepEqual(parseJsonObject('```json\n{"a":"b"}\n```'), { a: 'b' });
  assert.equal(parseJsonObject('not json at all'), null);
  assert.equal(parseJsonObject(null), null);
});

// --- pitch email fallback ---------------------------------------------------

console.log('\npitch email — template fallback');

await test('writer returning null yields the unchanged template email', async () => {
  const email = await composeEmail({ ...EMAIL_ARGS, writer: async () => null });
  assert.deepEqual(
    { subject: email.subject, body: email.body, signature: email.signature },
    TEMPLATE_EMAIL
  );
  assert.equal(email.ai_generated, false);
});

await test('writer throwing yields the template email too', async () => {
  const email = await composeEmail({
    ...EMAIL_ARGS,
    writer: async () => {
      throw new Error('model down');
    },
  });
  assert.equal(email.body, TEMPLATE_EMAIL.body);
  assert.equal(email.ai_generated, false);
});

await test('writer returning non-JSON prose yields the template email', async () => {
  const email = await composeEmail({ ...EMAIL_ARGS, writer: async () => 'Sorry, I cannot help with that.' });
  assert.equal(email.subject, TEMPLATE_EMAIL.subject);
  assert.equal(email.body, TEMPLATE_EMAIL.body);
  assert.equal(email.ai_generated, false);
});

await test('writer returning JSON replaces subject + body, keeps our signature', async () => {
  const email = await composeEmail({
    ...EMAIL_ARGS,
    writer: async () =>
      JSON.stringify({ subject: 'Acme: two things costing you mobile visitors', body: 'Hi Dana, quick note.' }),
  });
  assert.equal(email.subject, 'Acme: two things costing you mobile visitors');
  assert.equal(email.body, 'Hi Dana, quick note.');
  assert.equal(email.signature, TEMPLATE_EMAIL.signature);
  assert.equal(email.ai_generated, true);
});

await test('the prompt carries the real findings and forbids invented numbers', async () => {
  let seen = '';
  await composeEmail({
    ...EMAIL_ARGS,
    writer: async (prompt: string) => {
      seen = prompt;
      return null;
    },
  });
  assert.ok(seen.includes('Missing viewport meta tag'));
  assert.ok(seen.includes('No H1 heading found'));
  assert.ok(seen.includes('Do not invent numbers'));
});

// --- case study fallback ----------------------------------------------------

console.log('\ncase study — template fallback');

await test('writer returning null yields the unchanged template narrative', async () => {
  const study = await generateCaseStudy(CASE_INPUT, AUDIT, async () => null);

  assert.equal(study.ai_generated, false);
  assert.equal(
    study.problem,
    "Acme Co's website was underperforming. A technical audit of https://old-acme.example revealed 2 key issues:\n\n" +
      '1. Missing page title\n' +
      '2. 3 image(s) missing alt text' +
      '\n\nWith an overall site health score of 40/100, it was clear that Acme Co needed a complete digital overhaul to compete effectively in their market.'
  );
  assert.equal(
    study.solution,
    'We partnered with Acme Co to completely reimagine their digital experience. Our approach included:\n\n' +
      '- **Strategic Discovery**: Deep analysis of their target audience, competitive landscape, and business goals\n' +
      '- **UX & Design Overhaul**: Created a modern, intuitive interface optimized for conversion\n' +
      '- **Technical Implementation**: Built a high-performance, SEO-optimized platform\n' +
      '- **SEO Foundation**: Addressed critical on-page SEO gaps identified in the audit\n' +
      '- **Accessibility Improvements**: Ensured all content is accessible and properly structured\n' +
      '\nEvery decision was driven by data and focused on measurable business outcomes.'
  );
  assert.equal(
    study.executive_summary,
    'Acme Co partnered with us to transform their digital presence. Through a comprehensive redesign and development process, we delivered a modern, high-performance website that drove measurable improvements across all key metrics.'
  );
  assert.equal(study.narrative_title, 'Acme Co: Digital Transformation Case Study');
  assert.equal(study.results.startsWith('The transformation delivered exceptional results for Acme Co:'), true);
});

await test('metric blocks are identical whether or not the model answers', async () => {
  const fallback = await generateCaseStudy(CASE_INPUT, AUDIT, async () => null);
  const withModel = await generateCaseStudy(CASE_INPUT, AUDIT, async () => PROSE_JSON);

  assert.deepEqual(withModel.metrics, fallback.metrics);
  assert.deepEqual(withModel.metrics, buildMetrics(CASE_INPUT.traffic_data, CASE_INPUT.revenue_data));
  assert.equal(withModel.metrics.length, 3);
  assert.deepEqual(withModel.metrics[0], {
    label: 'Monthly Visitors',
    before: '8.0K',
    after: '24.0K',
    change: '+200%',
    positive: true,
  });
});

await test('model prose replaces the narrative but the audit issues stay verbatim', async () => {
  const study = await generateCaseStudy(CASE_INPUT, AUDIT, async () => PROSE_JSON);

  assert.equal(study.ai_generated, true);
  assert.ok(study.problem.startsWith('Acme Co had a slow, dated site'));
  assert.ok(study.problem.includes('1. Missing page title'));
  assert.ok(study.problem.includes('2. 3 image(s) missing alt text'));
  assert.ok(study.problem.includes('site health score of 40/100'));
  assert.equal(study.solution, 'We rebuilt the site around a single clear conversion path and a faster stack.');
  assert.ok(study.results.includes('- **Monthly Revenue**: $12.0K → $31.0K'));
  assert.ok(study.results.endsWith('The new site earns far more traffic and revenue than the old one did.'));
  assert.equal(
    study.executive_summary,
    'A full redesign that turned a dated brochure site into a growth channel.'
  );
  assert.equal(study.narrative_title, 'Acme Co: Digital Transformation Case Study');
});

await test('a partial model reply falls back to the template', async () => {
  const study = await generateCaseStudy(CASE_INPUT, AUDIT, async () =>
    JSON.stringify({ problem: 'only a problem', solution: 'only a solution' })
  );
  assert.equal(study.ai_generated, false);
  assert.ok(study.executive_summary.startsWith('Acme Co partnered with us'));
});

// --- per-tier monthly cap ---------------------------------------------------

console.log('\nper-tier monthly AI cap');

await initDb();

const USER_ID = 'ai-test-user';
getDb()
  .prepare("INSERT INTO users (id, email, password_hash, subscription_tier) VALUES (?, ?, ?, ?)")
  .run(USER_ID, 'ai-test@example.com', 'x', 'FREE');

await test('caps are FREE 20 / SOLO 100 / TEAM 300 / AGENCY unlimited', () => {
  assert.equal(capForTier('FREE'), 20);
  assert.equal(capForTier('SOLO'), 100);
  assert.equal(capForTier('TEAM'), 300);
  assert.equal(capForTier('AGENCY'), null);
  assert.equal(capForTier(undefined), 20);
  assert.equal(capForTier('nonsense'), 20);
  assert.equal(AI_MONTHLY_CAP.FREE, 20);
});

await test('monthlyPeriod is a UTC YYYY-MM key', () => {
  assert.equal(monthlyPeriod(new Date('2026-11-20T12:00:00Z')), '2026-11');
  assert.equal(monthlyPeriod(new Date('2026-01-02T00:00:00Z')), '2026-01');
});

await test('FREE tier: 20 generations allowed, the 21st is refused', () => {
  const period = '2030-01';
  for (let i = 1; i <= 20; i++) {
    const state = consumeAiGeneration(USER_ID, 'FREE', period);
    assert.equal(state.used, i);
    assert.equal(state.remaining, 20 - i);
    // `allowed` on the returned state means "another generation is still allowed".
    assert.equal(state.allowed, i < 20, `after generation ${i}`);
  }

  const blocked = consumeAiGeneration(USER_ID, 'FREE', period);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.used, 20);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.limit, 20);

  // A refused attempt must not consume anything.
  assert.equal(aiQuotaState(USER_ID, 'FREE', period).used, 20);
});

await test('the cap is per calendar month', () => {
  const nextMonth = aiQuotaState(USER_ID, 'FREE', '2030-02');
  assert.equal(nextMonth.allowed, true);
  assert.equal(nextMonth.used, 0);
  assert.equal(nextMonth.remaining, 20);
});

await test('an upgraded tier gets its own, larger allowance', () => {
  const state = consumeAiGeneration(USER_ID, 'SOLO', '2030-01');
  assert.equal(state.allowed, true);
  assert.equal(state.limit, 100);
  assert.equal(state.used, 21);
  assert.equal(state.remaining, 79);
});

await test('AGENCY is uncapped', () => {
  for (let i = 0; i < 50; i++) consumeAiGeneration(USER_ID, 'AGENCY', '2030-03');
  const state = consumeAiGeneration(USER_ID, 'AGENCY', '2030-03');
  assert.equal(state.allowed, true);
  assert.equal(state.limit, null);
  assert.equal(state.remaining, null);
});

// --- teardown ---------------------------------------------------------------

closeDb();
try {
  fs.rmSync(tmpDbPath, { force: true });
} catch {
  /* best effort */
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('Failing tests:', failures.join('; '));
  process.exit(1);
}
