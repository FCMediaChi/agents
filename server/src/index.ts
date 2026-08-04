import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb, persistDb, closeDb } from './db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import pageRoutes from './routes/pages.js';
import questionnaireRoutes from './routes/questionnaires.js';
import wireframeRoutes from './routes/wireframes.js';
import proposalRoutes from './routes/proposals.js';
import auditRoutes from '../../audit/routes/audit.js';
import accountRoutes from './routes/account.js';
import apiKeyRoutes from './routes/apiKeys.js';
import domainRoutes from './routes/domains.js';
import pipelineRoutes from './routes/pipeline.js';
import checkoutRoutes from './routes/checkout.js';
import inviteCodeRoutes from './routes/inviteCodes.js';
import webhookRoutes from './routes/webhooks.js';
import { apiKeyAuth, apiRateLimit } from './middleware/apiKeyAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = express();

  // Security & parsing middleware
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  app.use(cookieParser());

  // Stripe webhook — must mount BEFORE express.json() for raw body access
  app.use('/api/webhooks', webhookRoutes);

  app.use(express.json({ limit: '5mb' }));

  // API key auth + rate limiting
  app.use(apiKeyAuth);
  app.use(apiRateLimit);

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects', pageRoutes);
  app.use('/api/pages', questionnaireRoutes);
  app.use('/api/pages', wireframeRoutes);
  app.use('/api/projects', proposalRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/account', apiKeyRoutes);
  app.use('/api/account', domainRoutes);
  app.use('/api/pipeline', pipelineRoutes);
  app.use('/api', checkoutRoutes);
  app.use('/api/invite-codes', inviteCodeRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API documentation
  app.get('/api/docs', (_req, res) => {
    res.json({
      name: 'Nuria Website Blueprint API',
      version: '1.0',
      auth: 'Cookie-based (login via /api/auth/login) or API Key (X-API-Key header / ?api_key query param)',
      rate_limit: '100 requests/minute per API key',
      endpoints: {
        auth: [
          { method: 'POST', path: '/api/auth/register', body: '{ email, password }', description: 'Create account' },
          { method: 'POST', path: '/api/auth/login', body: '{ email, password }', description: 'Login' },
          { method: 'POST', path: '/api/auth/logout', description: 'Logout' },
          { method: 'GET', path: '/api/auth/me', description: 'Get current user' },
        ],
        projects: [
          { method: 'GET', path: '/api/projects', description: 'List projects' },
          { method: 'POST', path: '/api/projects', body: '{ title, description }', description: 'Create project' },
          { method: 'GET', path: '/api/projects/:id', description: 'Get project' },
          { method: 'PUT', path: '/api/projects/:id', body: '{ title, description }', description: 'Update project' },
          { method: 'DELETE', path: '/api/projects/:id', description: 'Delete project' },
        ],
        pages: [
          { method: 'GET', path: '/api/projects/:id/pages', description: 'List pages' },
          { method: 'POST', path: '/api/projects/:id/pages', body: '{ title, slug, page_type }', description: 'Create page' },
        ],
        api_keys: [
          { method: 'GET', path: '/api/account/api-keys', description: 'List API keys (Agency only)' },
          { method: 'POST', path: '/api/account/api-keys', body: '{ name }', description: 'Generate API key (Agency only)' },
          { method: 'DELETE', path: '/api/account/api-keys/:id', description: 'Revoke API key (Agency only)' },
        ],
      },
    });
  });

  // Host-based routing middleware
  // If accessed from audit. subdomain, redirect root to /audit
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (host.startsWith('audit.')) {
      // Redirect root to the audit page
      if (req.path === '/') {
        return res.redirect(302, '/audit');
      }
      // For API paths, let them pass through normally
      if (req.path.startsWith('/api/')) {
        return next();
      }
      // For SPA paths under audit, serve index.html (handled by catch-all below)
      // Rewrite the URL so the React app initializes at the audit route
      // This ensures direct navigation to /audit/* works correctly
      if (req.path.startsWith('/audit')) {
        return next();
      }
      // For any other non-API, non-audit path, redirect to /audit
      // This handles the case where someone visits audit.firstcreationmedia.com/random-path
      return res.redirect(302, '/audit');
    }
    next();
  });

  // Serve static frontend assets in production
  const distPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(distPath));

  // SPA fallback — serve index.html for any non-API route
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // Initialize database
  await initDb();

  // Start server
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Nuria Website Blueprint] Server running on http://0.0.0.0:${config.port}`);
    console.log(`[Nuria Website Blueprint] Environment: ${config.nodeEnv}`);
  });

  // Auto-persist DB periodically (every 10 seconds)
  const persistInterval = setInterval(() => persistDb(), 10000);

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Nuria Website Blueprint] Shutting down...');
    clearInterval(persistInterval);
    persistDb();
    closeDb();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Nuria Website Blueprint] Failed to start:', err);
  process.exit(1);
});