import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const loginSchema = z.object({
  email: z.string().email(),
});

const visitorLoginSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login by email (for employees)
  fastify.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid email' });
    }

    const { email } = result.data;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
      include: { sector: true },
    });

    if (!user) {
      // Create new user with default role
      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          role: 'user',
          status: 'online',
        },
        include: { sector: true },
      });
    }

    // Check if user is master
    const masterEmail = process.env.MASTER_EMAIL || 'admin@example.com';
    if (email === masterEmail && user.role !== 'master') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'master' },
        include: { sector: true },
      });
    }

    // Update status to online
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'online' },
    });

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
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
      },
    };
  });

  // Visitor login
  fastify.post('/visitor', async (request, reply) => {
    const result = visitorLoginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const { name, code } = result.data;

    // Find valid invite
    const invite = await prisma.visitorInvite.findFirst({
      where: {
        code,
        expiresAt: { gt: new Date() },
      },
      include: { usedBy: true },
    });

    if (!invite) {
      return reply.status(400).send({ error: 'Invalid or expired invite code' });
    }

    if (invite.usedBy) {
      return reply.status(400).send({ error: 'Invite code already in use' });
    }

    // Create visitor user
    const visitorEmail = `visitor-${Date.now()}@visitor.local`;
    const user = await prisma.user.create({
      data: {
        email: visitorEmail,
        name,
        role: 'visitor',
        status: 'online',
        visitorInviteId: invite.id,
      },
    });

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        status: user.status,
        sector: '',
        visitorInviteId: invite.id,
      },
    };
  });

  // Get current user
  fastify.get('/me', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.user as { id: string };

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
      visitorInviteId: user.visitorInviteId,
    };
  });

  // Logout
  fastify.post('/logout', {
    preHandler: [(fastify as any).authenticate],
  }, async (request) => {
    const { id } = request.user as { id: string };

    await prisma.user.update({
      where: { id },
      data: { status: 'offline', currentRoomId: null },
    });

    return { success: true };
  });
}
