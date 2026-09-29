import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb, persistDb, closeDb } from './db.js';
import authRoutes from './routes/auth.js';
import auditRoutes from './routes/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(cookieParser());
  // Run-html accepts pasted HTML up to 5MB, so allow a larger JSON body.
  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/audit', auditRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'nuria-audit-app', timestamp: new Date().toISOString() });
  });

  // API documentation
  app.get('/api/docs', (_req, res) => {
    res.json({
      name: 'Nuria Website Audit API',
      version: '0.1.0',
      auth: 'Cookie-based session (login via /api/auth/login)',
      endpoints: {
        auth: [
          { method: 'POST', path: '/api/auth/register', body: '{ email, password }', description: 'Create account' },
          { method: 'POST', path: '/api/auth/login', body: '{ email, password }', description: 'Log in' },
          { method: 'POST', path: '/api/auth/logout', description: 'Log out' },
          { method: 'GET', path: '/api/auth/me', description: 'Get current user' },
          { method: 'POST', path: '/api/auth/request-password-reset', body: '{ email }', description: 'Request a password reset' },
          { method: 'POST', path: '/api/auth/reset-password', body: '{ token, password }', description: 'Reset password' },
        ],
        audit: [
          { method: 'POST', path: '/api/audit/run', body: '{ url }', description: 'Run a website audit (no auth required — free tier)' },
          { method: 'POST', path: '/api/audit/run-html', body: '{ html, url }', description: 'Run an audit from pasted HTML' },
          { method: 'GET', path: '/api/audit/reports', description: 'List your audit reports' },
          { method: 'GET', path: '/api/audit/reports/:id', description: 'Get a full report with dimensions + checks' },
          { method: 'GET', path: '/api/audit/reports/:id/status', description: 'Poll a running report status' },
          { method: 'GET', path: '/api/audit/usage', description: 'Get free-tier usage + remaining audits' },
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
    console.log(`[Nuria Website Audit] Server running on http://0.0.0.0:${config.port}`);
    console.log(`[Nuria Website Audit] Environment: ${config.nodeEnv}`);
  });

  // Auto-persist DB periodically (every 10 seconds)
  const persistInterval = setInterval(() => persistDb(), 10000);

  const shutdown = () => {
    console.log('[Nuria Website Audit] Shutting down...');
    clearInterval(persistInterval);
    persistDb();
    closeDb();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Nuria Website Audit] Failed to start:', err);
  process.exit(1);
});
