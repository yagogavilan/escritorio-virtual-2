import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { mkdir } from 'fs/promises';

import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { officeRoutes } from './routes/office.js';
import { sectorRoutes } from './routes/sectors.js';
import { roomRoutes } from './routes/rooms.js';
import { inviteRoutes } from './routes/invites.js';
import { channelRoutes } from './routes/channels.js';
import { taskRoutes } from './routes/tasks.js';
import { announcementRoutes } from './routes/announcements.js';
import { uploadRoutes } from './routes/upload.js';
import { debugRoutes } from './routes/debug.js';
import { billingRoutes } from './routes/billing.js';
import { analyticsRoutes } from './routes/analytics.js';
import { setupWebSocket } from './websocket/index.js';

const UPLOAD_DIR = '/app/uploads';

export const prisma = new PrismaClient();

const fastify = Fastify({
  logger: true,
});

// Ensure upload directory exists
await mkdir(UPLOAD_DIR, { recursive: true });

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
});

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

await fastify.register(fastifyStatic, {
  root: UPLOAD_DIR,
  prefix: '/api/uploads/',
  decorateReply: false,
});

// JWT verification decorator
fastify.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(userRoutes, { prefix: '/api/users' });
await fastify.register(officeRoutes, { prefix: '/api/office' });
await fastify.register(sectorRoutes, { prefix: '/api/sectors' });
await fastify.register(roomRoutes, { prefix: '/api/rooms' });
await fastify.register(inviteRoutes, { prefix: '/api/invites' });
await fastify.register(channelRoutes, { prefix: '/api/channels' });
await fastify.register(taskRoutes, { prefix: '/api/tasks' });
await fastify.register(announcementRoutes, { prefix: '/api/announcements' });
await fastify.register(uploadRoutes, { prefix: '/api/upload' });
await fastify.register(billingRoutes, { prefix: '/api/billing' });
await fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
await fastify.register(debugRoutes, { prefix: '/api/debug' });

// Start server
const start = async () => {
  try {
    // Setup Socket.io BEFORE starting the server
    const io = new Server(fastify.server, {
      cors: {
        origin: true,
        credentials: true,
      },
      path: '/api/socket.io',
    });

    // Decorate fastify with io BEFORE starting (must be done before listen)
    fastify.decorate('io', io);

    // Now start the server
    const server = await fastify.listen({ port: 3001, host: '0.0.0.0' });

    // Setup WebSocket handlers
    await setupWebSocket(io);

    console.log(`Server listening on ${server}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
