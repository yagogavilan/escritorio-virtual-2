import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';
import crypto from 'crypto';

const createInviteSchema = z.object({
  durationInMinutes: z.number().int().positive().default(60),
});

export async function inviteRoutes(fastify: FastifyInstance) {
  // Get all invites (admin/master only)
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // CRITICAL: Filter invites by office
    const whereClause: any = {};
    if (currentUser.role !== 'master') {
      // Only show invites from users in the same office
      whereClause.creator = {
        officeId: currentUser.officeId || null,
      };
    }

    const invites = await prisma.visitorInvite.findMany({
      where: whereClause,
      include: {
        creator: { select: { id: true, name: true, officeId: true } },
        usedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((invite) => ({
      id: invite.id,
      code: invite.code,
      expiresAt: invite.expiresAt,
      durationInMinutes: invite.durationInMinutes,
      creatorId: invite.creatorId,
      creator: invite.creator,
      usedBy: invite.usedBy,
    }));
  });

  // Create invite (admin/master only)
  fastify.post('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string; role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = createInviteSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + result.data.durationInMinutes * 60 * 1000);

    const invite = await prisma.visitorInvite.create({
      data: {
        code,
        expiresAt,
        durationInMinutes: result.data.durationInMinutes,
        creatorId: currentUser.id,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    return {
      id: invite.id,
      code: invite.code,
      expiresAt: invite.expiresAt,
      durationInMinutes: invite.durationInMinutes,
      creatorId: invite.creatorId,
      creator: invite.creator,
    };
  });

  // Delete invite (admin/master only)
  fastify.delete('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Delete visitor user if exists
    const invite = await prisma.visitorInvite.findUnique({
      where: { id },
      include: { usedBy: true },
    });

    if (invite?.usedBy) {
      await prisma.user.delete({ where: { id: invite.usedBy.id } });
    }

    await prisma.visitorInvite.delete({ where: { id } });

    return { success: true };
  });

  // Validate invite code (public)
  fastify.get('/validate/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const invite = await prisma.visitorInvite.findFirst({
      where: {
        code: code.toUpperCase(),
        expiresAt: { gt: new Date() },
      },
      include: { usedBy: true },
    });

    if (!invite) {
      return reply.status(404).send({ error: 'Invalid or expired code' });
    }

    if (invite.usedBy) {
      return reply.status(400).send({ error: 'Code already in use' });
    }

    return {
      valid: true,
      expiresAt: invite.expiresAt,
      durationInMinutes: invite.durationInMinutes,
    };
  });
}
