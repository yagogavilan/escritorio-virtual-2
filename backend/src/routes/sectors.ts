import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const createSectorSchema = z.object({
  name: z.string().min(1),
  color: z.string().default('#3b82f6'),
});

const updateSectorSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

export async function sectorRoutes(fastify: FastifyInstance) {
  // Get all sectors
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request) => {
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    // Filter by officeId unless user is master
    const whereClause: any = {};
    if (currentUser.role !== 'master') {
      whereClause.officeId = currentUser.officeId || null;
    }

    const sectors = await prisma.sector.findMany({
      where: whereClause,
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });

    return sectors.map((sector) => ({
      id: sector.id,
      name: sector.name,
      color: sector.color,
      userCount: sector._count.users,
    }));
  });

  // Create sector (admin/master only)
  fastify.post('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = createSectorSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const sector = await prisma.sector.create({
      data: {
        ...result.data,
        officeId: currentUser.officeId,
      },
    });

    return {
      id: sector.id,
      name: sector.name,
      color: sector.color,
    };
  });

  // Update sector (admin/master only)
  fastify.put('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = updateSectorSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const sector = await prisma.sector.update({
      where: { id },
      data: result.data,
    });

    return {
      id: sector.id,
      name: sector.name,
      color: sector.color,
    };
  });

  // Delete sector (admin/master only)
  fastify.delete('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Remove users from this sector first
    await prisma.user.updateMany({
      where: { sectorId: id },
      data: { sectorId: null },
    });

    await prisma.sector.delete({ where: { id } });

    return { success: true };
  });
}
