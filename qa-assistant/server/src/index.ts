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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'nuria-qa-assistant', timestamp: new Date().toISOString() });
  });

  // API documentation
  app.get('/api/docs', (_req, res) => {
    res.json({
      name: 'Nuria Design QA Assistant API',
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
        projects: [
          { method: 'GET', path: '/api/projects', description: 'List projects' },
          { method: 'POST', path: '/api/projects', body: '{ name, website_url?, client_name?, platform?, website_type?, notes? }', description: 'Create project' },
          { method: 'GET', path: '/api/projects/:id', description: 'Get a project' },
          { method: 'PUT', path: '/api/projects/:id', body: 'Partial project fields', description: 'Update a project' },
          { method: 'DELETE', path: '/api/projects/:id', description: 'Delete a project' },
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
    console.log(`[Nuria Design QA Assistant] Server running on http://0.0.0.0:${config.port}`);
    console.log(`[Nuria Design QA Assistant] Environment: ${config.nodeEnv}`);
  });

  // Auto-persist DB periodically (every 10 seconds)
  const persistInterval = setInterval(() => persistDb(), 10000);

  const shutdown = () => {
    console.log('[Nuria Design QA Assistant] Shutting down...');
    clearInterval(persistInterval);
    persistDb();
    closeDb();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Nuria Design QA Assistant] Failed to start:', err);
  process.exit(1);
});
