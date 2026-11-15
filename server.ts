import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { runMigrations, seedDatabaseIfEmpty } from './server/db.ts';
import authRoutes from './server/routes/auth.ts';
import patientRoutes from './server/routes/patients.ts';
import recordsRoutes from './server/routes/records.ts';
import consentRoutes from './server/routes/consent.ts';
import aiRoutes from './server/routes/ai.ts';
import servicesRoutes from './server/routes/services.ts';
import billingRoutes from './server/routes/billing.ts';
import adminRoutes from './server/routes/admin.ts';

async function startServer() {
  // Initialize SQLite normalized schema and synthetic demo seed data
  runMigrations();
  seedDatabaseIfEmpty();

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Basic security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'MediLink Vault API',
      gemini_configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  // Modular API Routers
  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/records', recordsRoutes);
  app.use('/api/consent', consentRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/services', servicesRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/admin', adminRoutes);

  // Global API error fallback
  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    res.status(500).json({ error: message });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MediLink Vault server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MediLink Vault server:', err);
  process.exit(1);
});
