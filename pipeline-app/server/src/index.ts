import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb, persistDb, closeDb } from './db.js';
import authRoutes from './routes/auth.js';
import pipelineRoutes from './routes/pipeline.js';
import webhookRoutes from './routes/webhooks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(cookieParser());

  // Stripe webhook — must mount BEFORE express.json() so the route can read the
  // raw body for signature verification.
  app.use('/api/webhooks', webhookRoutes);

  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/pipeline', pipelineRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'nuria-pipeline-app', timestamp: new Date().toISOString() });
  });

  // API documentation
  app.get('/api/docs', (_req, res) => {
    res.json({
      name: 'Nuria Client Pipeline API',
      version: '0.1.0',
      auth: 'Cookie-based session (login via /api/auth/login)',
      endpoints: {
        auth: [
          { method: 'POST', path: '/api/auth/register', body: '{ email, password }', description: 'Create account (starts 7-day trial)' },
          { method: 'POST', path: '/api/auth/login', body: '{ email, password }', description: 'Log in' },
          { method: 'POST', path: '/api/auth/logout', description: 'Log out' },
          { method: 'GET', path: '/api/auth/me', description: 'Get current user' },
          { method: 'POST', path: '/api/auth/request-password-reset', body: '{ email }', description: 'Request a password reset' },
          { method: 'POST', path: '/api/auth/reset-password', body: '{ token, password }', description: 'Reset password' },
        ],
        pipeline: [
          { method: 'GET', path: '/api/pipeline/me', description: 'Get subscription + trial status (auth only)' },
          { method: 'GET', path: '/api/pipeline/agency', description: 'Get agency profile' },
          { method: 'POST', path: '/api/pipeline/onboarding', body: '{ agency_name, website_url, services, industries }', description: 'Create agency profile' },
          { method: 'PUT', path: '/api/pipeline/agency', body: '{ agency_name, website_url, services, industries }', description: 'Update agency profile' },
          { method: 'GET', path: '/api/pipeline/dashboard', description: 'Agency + case-study/pitch stats' },
          { method: 'GET', path: '/api/pipeline/case-studies', description: 'List case studies' },
          { method: 'GET', path: '/api/pipeline/case-studies/:id', description: 'Get a case study' },
          { method: 'POST', path: '/api/pipeline/case-studies', body: '{ client_name, client_url, old_site_url, traffic_data, revenue_data, screenshots }', description: 'Create a case study' },
          { method: 'PUT', path: '/api/pipeline/case-studies/:id', description: 'Update a case study' },
          { method: 'POST', path: '/api/pipeline/case-studies/:id/generate', description: 'Scrape old site + generate narrative case study' },
          { method: 'GET', path: '/api/pipeline/pitches', description: 'List pitches' },
          { method: 'GET', path: '/api/pipeline/pitches/:id', description: 'Get a pitch' },
          { method: 'POST', path: '/api/pipeline/pitches', body: '{ prospect_name, prospect_url, service }', description: 'Create a pitch' },
          { method: 'POST', path: '/api/pipeline/pitches/:id/analyze', description: 'Scrape prospect site + generate cold email' },
          { method: 'DELETE', path: '/api/pipeline/pitches/:id', description: 'Delete a pitch' },
        ],
      },
    });
  });

  // Serve static frontend assets in production
  const distPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(distPath));

  // SPA fallback — serve index.html for any non-API route
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  await initDb();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Nuria Client Pipeline] Server running on http://0.0.0.0:${config.port}`);
    console.log(`[Nuria Client Pipeline] Environment: ${config.nodeEnv}`);
  });

  // Auto-persist DB periodically (every 10 seconds)
  const persistInterval = setInterval(() => persistDb(), 10000);

  const shutdown = () => {
    console.log('[Nuria Client Pipeline] Shutting down...');
    clearInterval(persistInterval);
    persistDb();
    closeDb();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Nuria Client Pipeline] Failed to start:', err);
  process.exit(1);
});
