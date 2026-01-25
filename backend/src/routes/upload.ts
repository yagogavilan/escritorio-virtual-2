import { FastifyInstance } from 'fastify';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = '/app/uploads';

export async function uploadRoutes(fastify: FastifyInstance) {
  // Ensure upload directory exists
  await mkdir(UPLOAD_DIR, { recursive: true });

  // Upload avatar image
  fastify.post('/avatar', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string };

    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP' });
    }

    // Generate unique filename
    const ext = path.extname(data.filename) || '.jpg';
    const filename = `avatar-${currentUser.id}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Save file
    await pipeline(data.file, createWriteStream(filepath));

    // Return the URL
    const url = `/api/uploads/${filename}`;

    return { url, filename };
  });

  // Upload office logo
  fastify.post('/logo', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    // Only admin or master can upload logos
    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP, SVG' });
    }

    // Generate unique filename
    const ext = path.extname(data.filename) || '.png';
    const filename = `logo-${crypto.randomBytes(12).toString('hex')}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Save file
    await pipeline(data.file, createWriteStream(filepath));

    // Return the URL
    const url = `/api/uploads/${filename}`;

    return { url, filename };
  });

  // Generic file upload (for attachments, etc.)
  fastify.post('/file', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Limit file size (already configured in multipart, but double check)
    const maxSize = 10 * 1024 * 1024; // 10MB
    let size = 0;

    // Generate unique filename
    const ext = path.extname(data.filename) || '';
    const filename = `file-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Save file with size check
    const writeStream = createWriteStream(filepath);

    for await (const chunk of data.file) {
      size += chunk.length;
      if (size > maxSize) {
        writeStream.destroy();
        return reply.status(400).send({ error: 'File too large. Max 10MB' });
      }
      writeStream.write(chunk);
    }

    writeStream.end();

    const url = `/api/uploads/${filename}`;

    return {
      url,
      filename,
      originalName: data.filename,
      mimetype: data.mimetype,
      size,
    };
  });
}
