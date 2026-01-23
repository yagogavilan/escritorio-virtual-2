import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const visitorLoginSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login by email (for employees)
  fastify.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Email e senha são obrigatórios' });
    }

    const { email, password } = result.data;

    // Find user
    let user = await prisma.user.findUnique({
      where: { email },
      include: { sector: true, office: true },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas' });
    }

    // Check if user has password set
    if (!user.password) {
      return reply.status(401).send({ error: 'Usuário não possui senha configurada. Entre em contato com o administrador.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.status(401).send({ error: 'Credenciais inválidas' });
    }

    // Check if user is master
    const masterEmail = process.env.MASTER_EMAIL || 'admin@example.com';
    if (email === masterEmail && user.role !== 'master') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'master' },
        include: { sector: true, office: true },
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
      officeId: user.officeId,
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
        officeId: user.officeId,
        office: user.office ? { id: user.office.id, name: user.office.name } : null,
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

  // Change password
  fastify.post('/change-password', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.user as { id: string };

    const result = changePasswordSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Senha atual e nova senha são obrigatórias (mínimo 6 caracteres)' });
    }

    const { currentPassword, newPassword } = result.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    // Verify current password
    if (user.password) {
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return reply.status(401).send({ error: 'Senha atual incorreta' });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { success: true, message: 'Senha alterada com sucesso' };
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

  // Impersonate user (master only)
  fastify.post('/impersonate/:userId', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { role } = request.user as { id: string; role: string };
    const { userId } = request.params as { userId: string };

    // Only master users can impersonate
    if (role !== 'master') {
      return reply.status(403).send({ error: 'Apenas usuários master podem usar esta funcionalidade' });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { sector: true, office: true },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    // Generate token for target user
    const token = fastify.jwt.sign({
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      officeId: targetUser.officeId,
      impersonatedBy: (request.user as any).id, // Store who is impersonating
    });

    return {
      token,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        avatar: targetUser.avatar,
        role: targetUser.role,
        status: targetUser.status,
        statusMessage: targetUser.statusMessage,
        jobTitle: targetUser.jobTitle,
        sector: targetUser.sector?.name || '',
        sectorId: targetUser.sectorId,
        officeId: targetUser.officeId,
        office: targetUser.office ? { id: targetUser.office.id, name: targetUser.office.name } : null,
      },
    };
  });
}
