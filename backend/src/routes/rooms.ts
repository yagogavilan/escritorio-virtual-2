import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const createRoomSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['fixed']).default('fixed'),
  capacity: z.number().int().positive().default(10),
  isRestricted: z.boolean().default(false),
  color: z.string().optional(),
  backgroundImage: z.string().optional(),
  icon: z.string().optional(),
});

const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['fixed']).optional(),
  capacity: z.number().int().positive().optional(),
  isRestricted: z.boolean().optional(),
  color: z.string().nullable().optional(),
  backgroundImage: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

export async function roomRoutes(fastify: FastifyInstance) {
  // Get all rooms
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async () => {
    const rooms = await prisma.room.findMany({
      include: {
        participants: {
          select: {
            id: true,
            name: true,
            avatar: true,
            status: true,
          },
        },
        owner: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      isRestricted: room.isRestricted,
      color: room.color,
      backgroundImage: room.backgroundImage,
      icon: room.icon,
      participants: room.participants.map((p) => p.id),
      participantDetails: room.participants,
      ownerId: room.ownerId,
      owner: room.owner,
    }));
  });

  // Create room (admin/master only)
  fastify.post('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string; role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = createRoomSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const room = await prisma.room.create({
      data: {
        ...result.data,
        ownerId: currentUser.id,
      },
    });

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      isRestricted: room.isRestricted,
      color: room.color,
      backgroundImage: room.backgroundImage,
      icon: room.icon,
      participants: [],
    };
  });

  // Update room (admin/master only)
  fastify.put('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = updateRoomSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const room = await prisma.room.update({
      where: { id },
      data: result.data,
      include: { participants: true },
    });

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      isRestricted: room.isRestricted,
      color: room.color,
      backgroundImage: room.backgroundImage,
      icon: room.icon,
      participants: room.participants.map((p) => p.id),
    };
  });

  // Delete room (admin/master only)
  fastify.delete('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Remove all participants first
    await prisma.user.updateMany({
      where: { currentRoomId: id },
      data: { currentRoomId: null },
    });

    await prisma.room.delete({ where: { id } });

    return { success: true };
  });

  // Join room
  fastify.post('/:id/join', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    const room = await prisma.room.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    if (room.participants.length >= room.capacity) {
      return reply.status(400).send({ error: 'Room is full' });
    }

    // Leave current room if any
    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        currentRoomId: id,
        status: 'in_meeting',
      },
    });

    return { success: true, roomId: id };
  });

  // Leave room
  fastify.post('/:id/leave', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        currentRoomId: null,
        status: 'online',
      },
    });

    return { success: true };
  });

  // Knock on room (for restricted rooms)
  fastify.post('/:id/knock', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    // This will be handled via WebSocket for real-time notification
    return { success: true, roomId: id, userId: currentUser.id };
  });
}
