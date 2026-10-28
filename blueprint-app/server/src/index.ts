import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, isEmailConfigured } from './config.js';
import { initDb, persistDb, closeDb, getTableNames } from './db.js';
import authRoutes from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_NAME = 'nuria-blueprint-app';
const APP_LABEL = 'Nuria Website Blueprint';

async function main() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  // API routes
  app.use('/api/auth', authRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: APP_NAME,
      name: APP_LABEL,
      version: '0.1.0',
      phase: 'phase-1-scaffold',
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
