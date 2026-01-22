import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().optional(),
  role: z.enum(['master', 'admin', 'user', 'visitor']).optional(),
  jobTitle: z.string().optional(),
  sectorId: z.string().nullable().optional(),
  officeId: z.string().nullable().optional(),
  password: z.string().min(6).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['online', 'busy', 'away', 'offline', 'in_meeting']),
  statusMessage: z.string().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request) => {
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    // Master can see all users from all offices
    // Admin/User can only see users from their office
    const whereClause: any = {};
    if (currentUser.role !== 'master') {
      whereClause.officeId = currentUser.officeId || null;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: { sector: true, currentRoom: true, office: true },
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
      officeId: user.officeId,
      office: user.office ? { id: user.office.id, name: user.office.name } : null,
    }));
  });

  // Get single user
  fastify.get('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    const user = await prisma.user.findUnique({
      where: { id },
      include: { sector: true, currentRoom: true, office: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Check office access - master can see all, others only same office
    if (currentUser.role !== 'master' && user.officeId !== currentUser.officeId) {
      return reply.status(403).send({ error: 'Acesso negado. Você não pode visualizar usuários de outro escritório.' });
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
      officeId: user.officeId,
      office: user.office ? { id: user.office.id, name: user.office.name } : null,
    };
  });

  // Update user
  fastify.put('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    // Get target user to check office
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    // Check office access
    if (currentUser.role !== 'master' && targetUser.officeId !== currentUser.officeId) {
      return reply.status(403).send({ error: 'Acesso negado. Você não pode editar usuários de outro escritório.' });
    }

    // Only self, admin, or master can update
    if (currentUser.id !== id && !['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Acesso negado' });
    }

    const result = updateUserSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: result.error });
    }

    // Only master can change roles and officeId
    if (result.data.role && currentUser.role !== 'master') {
      delete result.data.role;
    }
    if (result.data.officeId !== undefined && currentUser.role !== 'master') {
      delete result.data.officeId;
    }

    // Handle password update
    const updateData: any = { ...result.data };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { sector: true, office: true },
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
      officeId: user.officeId,
      office: user.office ? { id: user.office.id, name: user.office.name } : null,
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
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Acesso negado' });
    }

    // Can't delete self
    if (currentUser.id === id) {
      return reply.status(400).send({ error: 'Você não pode deletar a si mesmo' });
    }

    // Get target user to check office
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    // Check office access
    if (currentUser.role !== 'master' && targetUser.officeId !== currentUser.officeId) {
      return reply.status(403).send({ error: 'Acesso negado. Você não pode deletar usuários de outro escritório.' });
    }

    await prisma.user.delete({ where: { id } });

    return { success: true };
  });

  // Create user (master/admin only)
  fastify.post('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Acesso negado' });
    }

    const createSchema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(6),
      role: z.enum(['admin', 'user']),
      jobTitle: z.string().optional(),
      sectorId: z.string().nullable().optional(),
      officeId: z.string().nullable().optional(),
    });

    const result = createSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: result.error });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: result.data.email },
    });

    if (existingUser) {
      return reply.status(400).send({ error: 'Já existe um usuário com este email' });
    }

    // Admin can only create users in their office
    let officeId = result.data.officeId;
    if (currentUser.role === 'admin') {
      officeId = currentUser.officeId || null;
    }

    const hashedPassword = await bcrypt.hash(result.data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: result.data.email,
        name: result.data.name,
        password: hashedPassword,
        role: result.data.role,
        jobTitle: result.data.jobTitle,
        sectorId: result.data.sectorId,
        officeId,
      },
      include: { sector: true, office: true },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      jobTitle: user.jobTitle,
      sector: user.sector?.name || '',
      sectorId: user.sectorId,
      officeId: user.officeId,
      office: user.office ? { id: user.office.id, name: user.office.name } : null,
    };
  });
}
