import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, isEmailConfigured } from './config.js';
import { initDb, persistDb, closeDb, getTableNames } from './db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import pageRoutes from './routes/pages.js';
import questionnaireRoutes from './routes/questionnaires.js';
import wireframeRoutes from './routes/wireframes.js';
import proposalRoutes from './routes/proposals.js';
import accountRoutes from './routes/account.js';
import apiKeyRoutes from './routes/apiKeys.js';
import domainRoutes from './routes/domains.js';
import clientPortalRoutes from './routes/clientPortal.js';
import webhookRoutes from './routes/webhooks.js';
import { apiKeyAuth, apiRateLimit } from './middleware/apiKeyAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_NAME = 'nuria-blueprint-app';
const APP_LABEL = 'Nuria Website Blueprint';

async function main() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(cookieParser());

  // Stripe webhook. MUST be mounted BEFORE express.json(): the handler needs the
  // RAW request body to verify the `stripe-signature` header. If the JSON parser
  // ran first the body would already be an object and every signature check
  // would fail ("No signatures found matching the expected signature").
  app.use('/api/webhooks', webhookRoutes);

  app.use(express.json({ limit: '2mb' }));

  // Agency API-key auth + per-key rate limiting. Mounted globally, exactly like
  // the monolith: a request carrying `x-api-key` (or `?api_key=`) resolves to a
  // user here and then passes through `authenticate` without a session cookie.
  app.use(apiKeyAuth);
  app.use(apiRateLimit);

  // API routes. Mount paths mirror the monolith so the Blueprint frontend
  // (ported in Phase 3) can keep its existing fetch URLs:
  //   projects.ts + pages.ts + proposals.ts  -> /api/projects/*
  //   questionnaires.ts + wireframes.ts      -> /api/pages/*
  //   account.ts + apiKeys.ts + domains.ts   -> /api/account/*
  app.use('/api/auth', authRoutes);
  // Client portal FIRST: GET /api/projects/:id/client-view is opened by a client
  // with no session, so it must not pass through the authenticated project
  // router (which applies `authenticate` to everything mounted below it).
  app.use('/api/projects', clientPortalRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects', pageRoutes);
  app.use('/api/pages', questionnaireRoutes);
  app.use('/api/pages', wireframeRoutes);
  app.use('/api/projects', proposalRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/account', apiKeyRoutes);
  app.use('/api/account', domainRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: APP_NAME,
      name: APP_LABEL,
      version: '0.1.0',
      phase: 'phase-4-pricing',
      database: path.basename(config.dbPath),
      tables: getTableNames().length,
      email: { provider: 'resend', configured: isEmailConfigured() },
      timestamp: new Date().toISOString(),
    });
  });

  // API documentation
  app.get('/api/docs', (_req, res) => {
    res.json({
      name: 'Nuria Website Blueprint API',
      version: '0.1.0',
      auth: `Cookie-based session (HTTP-only ${config.cookieName}, set on login)`,
      requiresEmailVerification: config.requireEmailVerification,
      endpoints: {
        webhooks: [
          { method: 'POST', path: '/api/webhooks/stripe', headers: 'stripe-signature', description: 'Stripe webhook: grants the tier implied by the price paid (checkout.session.completed), revokes on cancellation. Verified with STRIPE_WEBHOOK_SECRET.' },
        ],
        auth: [
          { method: 'POST', path: '/api/auth/register', body: '{ email, password }', description: 'Create an account and send the verification email' },
          { method: 'POST', path: '/api/auth/verify', body: '{ token }', description: 'Verify an email address' },
          { method: 'GET', path: '/api/auth/verify?token=…', description: 'Same as POST /verify (for links clicked in the inbox)' },
          { method: 'POST', path: '/api/auth/resend-verification', body: '{ email }', description: 'Resend the verification email (2-minute cooldown)' },
          { method: 'POST', path: '/api/auth/login', body: '{ email, password }', description: 'Log in (requires a verified email)' },
          { method: 'POST', path: '/api/auth/logout', description: 'Log out' },
          { method: 'GET', path: '/api/auth/me', description: 'Get the current user' },
          { method: 'POST', path: '/api/auth/forgot-password', body: '{ email }', description: 'Send a password-reset link' },
          { method: 'POST', path: '/api/auth/reset-password', body: '{ token, newPassword }', description: 'Reset the password with a token' },
        ],
        projects: [
          { method: 'GET', path: '/api/projects', description: 'List your planning projects' },
          { method: 'POST', path: '/api/projects', body: '{ title, description? }', description: 'Create a project (FREE tier: 1 lifetime, then 403 Limit Reached)' },
          { method: 'GET', path: '/api/projects/:id', description: 'Get one project' },
          { method: 'PUT', path: '/api/projects/:id', body: '{ title?, description?, branding_*? }', description: 'Update a project' },
          { method: 'DELETE', path: '/api/projects/:id', description: 'Delete a project' },
          { method: 'GET', path: '/api/projects/:id/pages', description: 'List the sitemap pages of a project' },
          { method: 'POST', path: '/api/projects/:id/pages', body: '{ title, parent_id?, page_type?, sort_order? }', description: 'Add a page (auto-creates its questionnaire + wireframe from the plan templates)' },
          { method: 'PUT', path: '/api/projects/:id/pages/:pageId', body: '{ title?, parent_id?, sort_order?, page_type? }', description: 'Update a page' },
          { method: 'PUT', path: '/api/projects/:id/pages/:pageId/outline', body: '{ description?, goals?, notes? }', description: 'Update the page outline' },
          { method: 'DELETE', path: '/api/projects/:id/pages/:pageId', description: 'Delete a page' },
          { method: 'GET', path: '/api/projects/:id/members', description: 'List project collaborators' },
          { method: 'POST', path: '/api/projects/:id/invite', body: '{ email, role? }', description: 'Invite a collaborator (editor | client)' },
          { method: 'GET', path: '/api/projects/:id/client-view?token=…', description: 'Client-portal read-only view' },
        ],
        content: [
          { method: 'GET', path: '/api/pages/:pageId/questionnaire', description: 'Get a page questionnaire (default questions generated with the page)' },
          { method: 'PUT', path: '/api/pages/:pageId/questionnaire', body: '{ answers }', description: 'Save questionnaire answers' },
          { method: 'GET', path: '/api/pages/:pageId/wireframe', description: 'Get a page wireframe (default blocks generated with the page)' },
          { method: 'PUT', path: '/api/pages/:pageId/wireframe', body: '{ blocks }', description: 'Save wireframe blocks (max 100)' },
          { method: 'POST', path: '/api/pages/:pageId/wireframe/export-html', description: 'Export the wireframe as HTML' },
          { method: 'GET', path: '/api/projects/:projectId/proposal', description: 'Get the project proposal (empty draft if none yet)' },
          { method: 'PUT', path: '/api/projects/:projectId/proposal', body: '{ client_name?, executive_summary?, pricing_estimate?, timeline_weeks?, terms_conditions?, status? }', description: 'Create or update the proposal' },
          { method: 'POST', path: '/api/projects/:projectId/proposal/export-doc', description: 'Export the proposal as a document' },
        ],
        account: [
          { method: 'GET', path: '/api/account/team', description: 'List team members (Team tier: 5 seats)' },
          { method: 'GET', path: '/api/account/whitelabel', description: 'Get white-label settings (Agency)' },
          { method: 'PUT', path: '/api/account/whitelabel', body: '{ enabled, companyName, logoUrl, primaryColor, secondaryColor }', description: 'Update white-label settings (Agency)' },
          { method: 'GET', path: '/api/account/blueprint-whitelabel', description: 'Get Blueprint white-label settings (Agency)' },
          { method: 'PUT', path: '/api/account/blueprint-whitelabel', body: '{ enabled, companyName, logoUrl, primaryColor, secondaryColor }', description: 'Update Blueprint white-label settings (Agency)' },
          { method: 'GET', path: '/api/account/api-keys', description: 'List API keys (Agency)' },
          { method: 'POST', path: '/api/account/api-keys', body: '{ name? }', description: 'Create an API key (Agency, max 5)' },
          { method: 'DELETE', path: '/api/account/api-keys/:id', description: 'Revoke an API key' },
          { method: 'GET', path: '/api/account/domains', description: 'List custom domains (Agency)' },
          { method: 'POST', path: '/api/account/domains', body: '{ domain }', description: 'Add a custom domain (Agency)' },
          { method: 'POST', path: '/api/account/domains/:id/verify', description: 'Verify a custom domain' },
          { method: 'DELETE', path: '/api/account/domains/:id', description: 'Remove a custom domain' },
        ],
        apiKeyAuth: 'Send x-api-key: nuria_… (or ?api_key=) instead of the session cookie on any /api route.',
      },
    });
  });

  // Serve static frontend assets in production
  const distPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(distPath));

  // SPA fallback — serve index.html for any non-API route
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next();
    });
  });

  // Central error handler (async route rejections land here)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(`[${APP_LABEL}] Unhandled route error:`, err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  });

  await initDb();
  const tables = getTableNames();
  console.log(`[${APP_LABEL}] Database ready at ${config.dbPath} (${tables.length} tables: ${tables.join(', ')})`);

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[${APP_LABEL}] Server running on http://0.0.0.0:${config.port}`);
    console.log(`[${APP_LABEL}] Environment: ${config.nodeEnv}`);
    console.log(
      `[${APP_LABEL}] Email: Resend ${isEmailConfigured() ? 'configured (RESEND_API_KEY set)' : 'not configured — emails are logged, not sent (dev mode)'}`
    );
  });

  // Auto-persist DB periodically (every 10 seconds)
  const persistInterval = setInterval(() => persistDb(), 10000);

  const shutdown = () => {
    console.log(`[${APP_LABEL}] Shutting down...`);
    clearInterval(persistInterval);
    persistDb();
    closeDb();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`[${APP_LABEL}] Failed to start:`, err);
  process.exit(1);
});
