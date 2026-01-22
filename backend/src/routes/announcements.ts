import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  imageUrl: z.string().optional(),
  soundUrl: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  recipients: z.array(z.string()).default([]),
});

export async function announcementRoutes(fastify: FastifyInstance) {
  // Get all announcements
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request) => {
    const currentUser = request.user as { id: string };
    const { limit = '20' } = request.query as { limit?: string };

    const announcements = await prisma.announcement.findMany({
      where: {
        AND: [
          {
            OR: [
              { recipients: { isEmpty: true } },
              { recipients: { has: currentUser.id } },
            ],
          },
          {
            OR: [
              { scheduledFor: null },
              { scheduledFor: { lte: new Date() } },
            ],
          },
        ],
      },
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        readBy: {
          where: { userId: currentUser.id },
          select: { userId: true },
        },
      },
    });

    return announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      imageUrl: announcement.imageUrl,
      soundUrl: announcement.soundUrl,
      senderId: announcement.senderId,
      sender: announcement.sender,
      recipients: announcement.recipients,
      createdAt: announcement.createdAt,
      scheduledFor: announcement.scheduledFor,
      isRead: announcement.readBy.length > 0,
    }));
  });

  // Create announcement (admin/master only)
  fastify.post('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string; role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = createAnnouncementSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const announcement = await prisma.announcement.create({
      data: {
        ...result.data,
        scheduledFor: result.data.scheduledFor ? new Date(result.data.scheduledFor) : null,
        senderId: currentUser.id,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    return {
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      imageUrl: announcement.imageUrl,
      soundUrl: announcement.soundUrl,
      senderId: announcement.senderId,
      sender: announcement.sender,
      recipients: announcement.recipients,
      createdAt: announcement.createdAt,
      scheduledFor: announcement.scheduledFor,
    };
  });

  // Mark as read
  fastify.post('/:id/read', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) {
      return reply.status(404).send({ error: 'Announcement not found' });
    }

    await prisma.announcementRead.upsert({
      where: {
        userId_announcementId: {
          userId: currentUser.id,
          announcementId: id,
        },
      },
      create: {
        userId: currentUser.id,
        announcementId: id,
      },
      update: {},
    });

    return { success: true };
  });

  // Delete announcement (admin/master only)
  fastify.delete('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await prisma.announcement.delete({ where: { id } });

    return { success: true };
  });
}
