import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().optional(),
  role: z.enum(['master', 'admin', 'user', 'visitor']).optional(),
  jobTitle: z.string().optional(),
  sectorId: z.string().nullable().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['online', 'busy', 'away', 'offline', 'in_meeting']),
  statusMessage: z.string().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async () => {
    const users = await prisma.user.findMany({
      include: { sector: true, currentRoom: true },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      statusMessage: user.statusMessage,
      jobTitle: user.jobTitle,
      sector: user.sector?.name || '',
      sectorId: user.sectorId,
      currentRoomId: user.currentRoomId,
      visitorInviteId: user.visitorInviteId,
    }));
  });

  // Get single user
  fastify.get('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      include: { sector: true, currentRoom: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      statusMessage: user.statusMessage,
      jobTitle: user.jobTitle,
      sector: user.sector?.name || '',
      sectorId: user.sectorId,
      currentRoomId: user.currentRoomId,
    };
  });

  // Update user
  fastify.put('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string; role: string };

    // Only self, admin, or master can update
    if (currentUser.id !== id && !['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = updateUserSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data', details: result.error });
    }

    // Only master can change roles
    if (result.data.role && currentUser.role !== 'master') {
      delete result.data.role;
    }

    const user = await prisma.user.update({
      where: { id },
      data: result.data,
      include: { sector: true },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      statusMessage: user.statusMessage,
      jobTitle: user.jobTitle,
      sector: user.sector?.name || '',
      sectorId: user.sectorId,
    };
  });

  // Update user status
  fastify.patch('/:id/status', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    // Only self can update status
    if (currentUser.id !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = updateStatusSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        status: result.data.status,
        statusMessage: result.data.statusMessage,
      },
    });

    return {
      id: user.id,
      status: user.status,
      statusMessage: user.statusMessage,
    };
  });

  // Delete user (master/admin only)
  fastify.delete('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string; role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Can't delete self
    if (currentUser.id === id) {
      return reply.status(400).send({ error: 'Cannot delete yourself' });
    }

    await prisma.user.delete({ where: { id } });

    return { success: true };
  });
}
