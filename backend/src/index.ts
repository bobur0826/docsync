// backend/src/index.ts

import 'dotenv/config';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import path from 'path';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/documents.js';
import { transmittalRoutes } from './routes/transmittals.js';
import { projectRoutes } from './routes/projects.js';
import { workflowRoutes } from './routes/workflows.js';
import { userRoutes } from './routes/users.js';
import { taskRoutes } from './routes/tasks.js';
import { authenticate } from './middleware/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

async function build(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow any localhost origin in development, plus the configured FRONTEND_URL
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin) || origin === process.env.FRONTEND_URL) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET is required'); })(),
    sign: { expiresIn: '7d' },
  });

  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
  });

  app.decorate('authenticate', authenticate);

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Serve locally uploaded files in development
  if (process.env.NODE_ENV !== 'production') {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const { promises: fs } = await import('fs');
    await fs.mkdir(uploadsDir, { recursive: true });
    await app.register(staticPlugin, {
      root: uploadsDir,
      prefix: '/uploads/',
    });
  }

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(projectRoutes, { prefix: '/api/v1/projects' });
  await app.register(documentRoutes, { prefix: '/api/v1/documents' });
  await app.register(transmittalRoutes, { prefix: '/api/v1/transmittals' });
  await app.register(workflowRoutes, { prefix: '/api/v1/workflows' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(taskRoutes, { prefix: '/api/v1/tasks' });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: error.name ?? 'Internal Server Error',
      message: error.message,
    });
  });

  return app;
}

async function start(): Promise<void> {
  const app = await build();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
