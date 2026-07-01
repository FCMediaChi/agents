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
  app.use(express.json({ limit: '5mb' }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects', pageRoutes);
  app.use('/api/pages', questionnaireRoutes);
  app.use('/api/pages', wireframeRoutes);
  app.use('/api/projects', proposalRoutes);
  app.use('/api/audit', auditRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    console.log(`[TheBlueprint] Server running on http://0.0.0.0:${config.port}`);
    console.log(`[TheBlueprint] Environment: ${config.nodeEnv}`);
  });

  // Auto-persist DB periodically (every 10 seconds)
  const persistInterval = setInterval(() => persistDb(), 10000);

  // Graceful shutdown
  const shutdown = () => {
    console.log('[TheBlueprint] Shutting down...');
    clearInterval(persistInterval);
    persistDb();
    closeDb();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[TheBlueprint] Failed to start:', err);
  process.exit(1);
});