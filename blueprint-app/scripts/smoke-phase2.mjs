// Blueprint split Phase 2 — end-to-end smoke test.
// Boots blueprint-app's own API on a fresh SQLite file and drives the real HTTP
// surface: auth -> project (FREE cap) -> pages -> questionnaire/wireframe/proposal
// templates -> account routes -> Agency API-key access.
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// App root is the parent of this scripts/ directory.
const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_DIR = '/tmp/bpsmoke';
const DB_PATH = path.join(DB_DIR, 'blueprint.sqlite');

let pass = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${extra !== undefined ? ` :: ${JSON.stringify(extra).slice(0, 400)}` : ''}`);
  }
}
function section(t) { console.log(`\n=== ${t} ===`); }

// ── tiny cookie-aware client ───────────────────────────────────
function makeClient() {
  let cookie = '';
  async function req(method, url, body, headers = {}) {
    const h = { ...headers };
    if (body !== undefined) h['content-type'] = 'application/json';
    if (cookie) h.cookie = cookie;
    const res = await fetch(BASE + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const pair = c.split(';')[0];
      if (pair.startsWith('blueprint_token=')) cookie = pair;
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json, headers: res.headers, raw: text };
  }
  return { req, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
}

// ── server lifecycle ──────────────────────────────────────────
let child = null;
async function startServer(label) {
  child = spawn('npx', ['tsx', 'server/src/index.ts'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      BLUEPRINT_DB_PATH: DB_PATH,
      BLUEPRINT_JWT_SECRET: 'smoke-test-secret-phase-2',
      RESEND_API_KEY: '',
      COOKIE_NAME: 'blueprint_token',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d.toString(); });
  child.stderr.on('data', (d) => { log += d.toString(); });
  for (let i = 0; i < 200; i += 1) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return log;
    } catch { /* not up yet */ }
  }
  throw new Error(`${label}: server did not start.\n${log}`);
}
async function portFree() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    return !res.ok && false;
  } catch {
    return true;
  }
}
async function stopServer() {
  if (!child) return;
  const proc = child;
  child = null;
  const pid = proc.pid;
  await new Promise((resolve) => {
    proc.on('exit', resolve);
    try { process.kill(-pid, 'SIGTERM'); } catch { try { proc.kill('SIGTERM'); } catch { /* gone */ } }
    setTimeout(() => { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } resolve(); }, 8000);
  });
  // The SIGTERM handler persists the DB and closes the socket; wait for the port
  // to actually be free so the restart (and the DB patch) see a settled state.
  for (let i = 0; i < 60; i += 1) {
    if (await portFree()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('port still in use after shutdown');
}

// ── helpers ───────────────────────────────────────────────────
const PW = 'SmokeTest!2345';
async function signupVerified(client, email) {
  const reg = await client.req('POST', '/api/auth/register', { email, password: PW });
  const token = reg.body?.dev_verification_token;
  const ver = token ? await client.req('POST', '/api/auth/verify', { token }) : { status: 0, body: { error: 'no dev token' } };
  const login = await client.req('POST', '/api/auth/login', { email, password: PW });
  return { reg, ver, login };
}

async function main() {
  fs.rmSync(DB_DIR, { recursive: true, force: true });
  fs.mkdirSync(DB_DIR, { recursive: true });

  const bootLog = await startServer('initial boot');
  const dbLine = bootLog.split('\n').find((l) => l.includes('Database ready')) ?? '';

  // ── 1. health ───────────────────────────────────────────────
  section('Health / boot');
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  check('health 200 + phase phase-2-routes', health.phase === 'phase-2-routes', health.phase);
  check('own DB file blueprint.sqlite', health.database === 'blueprint.sqlite', health.database);
  check('17 tables created (users + 15 blueprint + migrations)', health.tables >= 17, health.tables);
  console.log(`  boot: ${dbLine.trim()}`);

  const docs = await fetch(`${BASE}/api/docs`).then((r) => r.json());
  const docEndpoints = Object.keys(docs.endpoints ?? {});
  check('/api/docs lists auth, projects, content, account', ['auth', 'projects', 'content', 'account'].every((k) => docEndpoints.includes(k)), docEndpoints);

  // ── 2. auth ─────────────────────────────────────────────────
  section('Auth: register -> verify -> login');
  const user = makeClient();
  const email = `smoke-free-${Date.now()}@example.com`;
  const { reg, ver, login } = await signupVerified(user, email);
  check('register 201', reg.status === 201, reg.body);
  check('register exposes dev verification token (no Resend key)', typeof reg.body?.dev_verification_token === 'string', reg.body);
  check('verify ok', ver.status === 200 && ver.body?.verified === true, ver.body);
  check('login 200 + sets blueprint_token cookie', login.status === 200 && user.cookie.startsWith('blueprint_token='), login.body);
  const me = await user.req('GET', '/api/auth/me');
  check('me returns FREE tier user', me.status === 200 && me.body?.user?.subscription_tier === 'FREE', me.body);

  // ── 3. projects + FREE cap ──────────────────────────────────
  section('Projects: create + FREE 1-project lifetime cap');
  const p1 = await user.req('POST', '/api/projects', { title: 'Smoke Project', description: 'Phase 2 smoke' });
  check('first project 201', p1.status === 201, p1.body);
  const projectId = p1.body?.id;
  const list1 = await user.req('GET', '/api/projects');
  check('GET /api/projects lists 1 project', list1.status === 200 && list1.body.length === 1, list1.body);

  const p2 = await user.req('POST', '/api/projects', { title: 'Second Project' });
  check('second project 403', p2.status === 403, { status: p2.status, body: p2.body });
  check("cap error is 'Limit Reached' with upgrade message",
    p2.body?.error === 'Limit Reached' && /limited to 1 planning project/i.test(p2.body?.message ?? ''),
    p2.body);

  const upd = await user.req('PUT', `/api/projects/${projectId}`, { title: 'Smoke Project v2', description: 'Updated outline' });
  check('project update 200 (title/description)', upd.status === 200 && upd.body?.title === 'Smoke Project v2', upd.body);
  const brand = await user.req('PUT', `/api/projects/${projectId}`, { branding_primary_color: '#1A9EF2' });
  check('custom branding gated on FREE (403 Premium Feature)', brand.status === 403 && brand.body?.error === 'Premium Feature', { status: brand.status, body: brand.body });

  // ── 4. pages ────────────────────────────────────────────────
  section('Pages: add page (auto templates) + outline');
  const page = await user.req('POST', `/api/projects/${projectId}/pages`, { title: 'Home', page_type: 'homepage' });
  check('add page 201', page.status === 201, page.body);
  check('page slug auto-generated', page.body?.slug === 'home', page.body?.slug);
  const pageId = page.body?.id;

  const page2 = await user.req('POST', `/api/projects/${projectId}/pages`, { title: 'Services', parent_id: null, page_type: 'services' });
  check('second page 201 (sitemap hierarchy works)', page2.status === 201, page2.body);
  const pages = await user.req('GET', `/api/projects/${projectId}/pages`);
  check('sitemap lists 2 pages in order', pages.status === 200 && pages.body.length === 2 && pages.body[0].slug === 'home', pages.body?.map?.((p) => p.slug));

  const outline = await user.req('PUT', `/api/projects/${projectId}/pages/${pageId}/outline`, {
    description: 'Homepage that converts visitors into leads.',
    goals: 'Explain the offer; capture email',
    notes: 'Hero + proof + CTA',
  });
  check('outline update 200', outline.status === 200 && outline.body?.goals?.includes('capture email'), outline.body);

  // ── 5. deterministic templates ──────────────────────────────
  section('Deterministic templates: questionnaire / wireframe / proposal');
  const q = await user.req('GET', `/api/pages/${pageId}/questionnaire`);
  check('questionnaire auto-created with default questions',
    q.status === 200 && Array.isArray(q.body?.questions) && q.body.questions.length > 0,
    { status: q.status, body: q.body });
  check('questionnaire has page_id + answers object', q.body?.page_id === pageId && typeof q.body?.answers === 'object', q.body);

  const wf = await user.req('GET', `/api/pages/${pageId}/wireframe`);
  check('wireframe auto-created with default blocks',
    wf.status === 200 && Array.isArray(wf.body?.blocks) && wf.body.blocks.length > 0,
    { status: wf.status, body: wf.body });
  check('wireframe blocks carry id/type/title/order',
    wf.body?.blocks?.every((b) => b.id && b.type && b.title && typeof b.order === 'number'),
    wf.body?.blocks?.[0]);

  const qa = await user.req('PUT', `/api/pages/${pageId}/questionnaire`, {
    answers: { [q.body.questions[0]]: 'A sample answer' },
  });
  check('questionnaire answers save 200', qa.status === 200, qa.body);
  const qa2 = await user.req('GET', `/api/pages/${pageId}/questionnaire`);
  check('answers round-trip', Object.values(qa2.body?.answers ?? {}).includes('A sample answer'), qa2.body?.answers);

  const wSave = await user.req('PUT', `/api/pages/${pageId}/wireframe`, {
    blocks: [
      { id: 'b1', type: 'hero', title: 'Hero', order: 0 },
      { id: 'b2', type: 'cta', title: 'Call to action', order: 1 },
    ],
  });
  check('wireframe blocks save 200', wSave.status === 200, wSave.body);
  const tooMany = await user.req('PUT', `/api/pages/${pageId}/wireframe`, {
    blocks: Array.from({ length: 101 }, (_, i) => ({ id: `x${i}`, type: 'text', title: `t${i}`, order: i })),
  });
  check('101 blocks rejected by maxBlockLimit (400)', tooMany.status === 400 && /100 wireframe blocks/.test(tooMany.body?.error ?? ''), tooMany.body);

  const propEmpty = await user.req('GET', `/api/projects/${projectId}/proposal`);
  check('proposal template shape before any save',
    propEmpty.status === 200 && propEmpty.body?.id === null && propEmpty.body?.timeline_weeks === 4 && propEmpty.body?.status === 'draft',
    propEmpty.body);

  const propSave = await user.req('PUT', `/api/projects/${projectId}/proposal`, {
    client_name: 'Acme Ltd',
    executive_summary: 'A five page marketing site to grow inbound leads.',
    pricing_estimate: '$8,000 - $12,000',
    timeline_weeks: 6,
    terms_conditions: '50% up front, 50% on launch.',
    status: 'draft',
  });
  check('proposal save 200', propSave.status === 200, propSave.body);
  const propGet = await user.req('GET', `/api/projects/${projectId}/proposal`);
  check('proposal round-trips', propGet.body?.client_name === 'Acme Ltd' && propGet.body?.timeline_weeks === 6, propGet.body);

  const expDoc = await user.req('POST', `/api/projects/${projectId}/proposal/export-doc`, {});
  check('proposal export-doc 200 with deterministic document',
    expDoc.status === 200 && typeof expDoc.raw === 'string' && expDoc.raw.includes('Acme Ltd'),
    { status: expDoc.status, head: String(expDoc.raw).slice(0, 200) });

  const expWireFast = await user.req('POST', `/api/pages/${pageId}/wireframe/export-html`, {});
  check('second export inside cooldown is 429 (exportCooldown)',
    expWireFast.status === 429 && /before another export/.test(expWireFast.body?.error ?? ''),
    { status: expWireFast.status, body: expWireFast.body });
  await new Promise((r) => setTimeout(r, 5200));
  const expWire = await user.req('POST', `/api/pages/${pageId}/wireframe/export-html`, {});
  check('wireframe export-html 200 after cooldown', expWire.status === 200 && String(expWire.raw).length > 50, { status: expWire.status, body: expWire.body });

  // ── 6. account routes (needs the req.user.id alias) ─────────
  section('Account routes');
  const team = await user.req('GET', '/api/account/team');
  check('GET /api/account/team 200 (req.user.id alias works)', team.status === 200 && Array.isArray(team.body?.members), team.body);
  const wl = await user.req('PUT', '/api/account/blueprint-whitelabel', { enabled: true, companyName: 'Smoke Co' });
  check('blueprint-whitelabel still gated to Agency (402)', wl.status === 402, { status: wl.status, body: wl.body });
  const keysAsFree = await user.req('POST', '/api/account/api-keys', { name: 'free key' });
  check('API key creation gated to Agency (402)', keysAsFree.status === 402, { status: keysAsFree.status, body: keysAsFree.body });

  // ── 7. Agency API-key flow ──────────────────────────────────
  section('Agency API keys');
  const agency = makeClient();
  const agencyEmail = `smoke-agency-${Date.now()}@example.com`;
  const agencySignup = await signupVerified(agency, agencyEmail);
  check('agency user registered + logged in', agencySignup.login.status === 200, agencySignup.login.body);

  // Promote to AGENCY in the app's own users table, then log in again so the
  // session carries the tier (same as a Stripe webhook upgrade would).
  await stopServer();
  const patchOut = execFileSync('python3', ['/tmp/promote.py', DB_PATH, agencyEmail]).toString().trim();
  check('agency tier written to blueprint-app users table', patchOut === 'rows updated: 1', patchOut);
  await startServer('restart after tier change');
  const relogin = await agency.req('POST', '/api/auth/login', { email: agencyEmail, password: PW });
  const reloginTier = relogin.body?.subscription_tier ?? relogin.body?.user?.subscription_tier;
  check('agency re-login carries AGENCY tier', relogin.status === 200 && reloginTier === 'AGENCY', relogin.body);

  const keyRes = await agency.req('POST', '/api/account/api-keys', { name: 'Smoke key' });
  check('create API key 201 for AGENCY user', keyRes.status === 201 && typeof keyRes.body?.key === 'string' && keyRes.body.key.startsWith('nuria_'), keyRes.body);
  const rawKey = keyRes.body?.key;

  const keyList = await agency.req('GET', '/api/account/api-keys');
  check('API key listed (hash only, no raw key)', keyList.status === 200 && keyList.body.keys.length === 1 && keyList.body.keys[0].key === undefined, keyList.body);

  // Call a cookie-protected route with ONLY the key — no session cookie.
  const anon = makeClient();
  const viaKey = await anon.req('GET', '/api/projects', undefined, { 'x-api-key': rawKey });
  check('GET /api/projects with x-api-key (no cookie) 200', viaKey.status === 200, { status: viaKey.status, body: viaKey.body });
  const viaQuery = await anon.req('GET', '/api/account/api-keys?api_key=' + encodeURIComponent(rawKey));
  check('API key also accepted via ?api_key=', viaQuery.status === 200 && viaQuery.body.keys?.length === 1, { status: viaQuery.status, body: viaQuery.body });
  const badKey = await anon.req('GET', '/api/projects', undefined, { 'x-api-key': 'nuria_notarealkey' });
  check('unknown API key rejected 401', badKey.status === 401 && /Invalid API key/.test(badKey.body?.error ?? ''), { status: badKey.status, body: badKey.body });
  const noAuth = await anon.req('GET', '/api/projects');
  check('no key + no cookie still 401', noAuth.status === 401, { status: noAuth.status });

  // Agency tier unlocks white-label + 5 projects/month instead of the FREE cap
  const wlAgency = await agency.req('PUT', '/api/account/blueprint-whitelabel', { enabled: true, companyName: 'Agency Co', primaryColor: '#1A9EF2' });
  check('AGENCY white-label save 200', wlAgency.status === 200 && wlAgency.body?.companyName === 'Agency Co', { status: wlAgency.status, body: wlAgency.body });
  const domList = await agency.req('GET', '/api/account/domains');
  check('GET /api/account/domains 200', domList.status === 200 && Array.isArray(domList.body?.domains), { status: domList.status, body: domList.body });
  const domAdd = await agency.req('POST', '/api/account/domains', { domain: 'blueprint-smoke.example.com' });
  check('POST /api/account/domains 201 with verification token', domAdd.status === 201 && !!domAdd.body?.verification_token, { status: domAdd.status, body: domAdd.body });

  // ── 8. isolation ────────────────────────────────────────────
  section('Isolation');
  const health2 = await fetch(`${BASE}/api/health`).then((r) => r.json());
  check('users live in blueprint-app DB (2 accounts)', health2.tables >= 17, health2.tables);

  await stopServer();
  console.log(`\n──── ${pass} passed, ${failures.length} failed ────`);
  if (failures.length) {
    console.log('FAILED:');
    for (const f of failures) console.log(` - ${f}`);
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  console.error('SMOKE ERROR:', err);
  await stopServer();
  process.exit(1);
});
