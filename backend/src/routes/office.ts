import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const createOfficeSchema = z.object({
  name: z.string().min(1),
  logo: z.string().optional(),
  primaryColor: z.string().optional(),
  workingHoursEnabled: z.boolean().optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
});

const updateOfficeSchema = z.object({
  name: z.string().min(1).optional(),
  logo: z.string().optional(),
  primaryColor: z.string().optional(),
  workingHoursEnabled: z.boolean().optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
});

export async function officeRoutes(fastify: FastifyInstance) {
  // Get office settings
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string; role: string; officeId?: string | null };

    // CRITICAL: Only return the user's office, never another office!
    let office = null;

    if (currentUser.officeId) {
      // User has an office - return only THEIR office
      office = await prisma.office.findUnique({
        where: { id: currentUser.officeId },
      });

      if (!office) {
        return reply.status(404).send({
          error: 'Escritório não encontrado. Contate o administrador.'
        });
      }
    } else {
      // User has NO office (master/demo) - return demo office
      office = await prisma.office.findFirst({
        where: { name: 'Demo Office' },
      });

      if (!office) {
        // Create demo office if doesn't exist
        office = await prisma.office.create({
          data: {
            name: 'Demo Office',
            logo: '',
            primaryColor: '#3b82f6',
          },
        });
      }
    }

    return {
      id: office.id,
      name: office.name,
      logo: office.logo,
      primaryColor: office.primaryColor,
      workingHours: {
        enabled: office.workingHoursEnabled,
        start: office.workingHoursStart,
        end: office.workingHoursEnd,
      },
    };
  });

  // Update office settings (admin/master only)
  fastify.put('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = updateOfficeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    let office = await prisma.office.findFirst();

    if (!office) {
      office = await prisma.office.create({
        data: {
          name: result.data.name || 'Nexus Office',
          logo: result.data.logo || '',
          primaryColor: result.data.primaryColor || '#3b82f6',
          workingHoursEnabled: result.data.workingHoursEnabled || false,
          workingHoursStart: result.data.workingHoursStart || '08:00',
          workingHoursEnd: result.data.workingHoursEnd || '18:00',
        },
      });
    } else {
      office = await prisma.office.update({
        where: { id: office.id },
        data: result.data,
      });
    }

    return {
      id: office.id,
      name: office.name,
      logo: office.logo,
      primaryColor: office.primaryColor,
      workingHours: {
        enabled: office.workingHoursEnabled,
        start: office.workingHoursStart,
        end: office.workingHoursEnd,
      },
    };
  });

  // Get all offices (master only)
  fastify.get('/all', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado. Apenas usuários master podem listar todos os escritórios.' });
    }

    const offices = await prisma.office.findMany({
      include: {
        _count: {
          select: {
            users: true,
            rooms: true,
            sectors: true,
          },
        },
      },
    });

    return offices.map(office => ({
      id: office.id,
      name: office.name,
      logo: office.logo,
      primaryColor: office.primaryColor,
      workingHours: {
        enabled: office.workingHoursEnabled,
        start: office.workingHoursStart,
        end: office.workingHoursEnd,
      },
      stats: {
        users: office._count.users,
        rooms: office._count.rooms,
        sectors: office._count.sectors,
      },
    }));
  });

  // Create new office (master only)
  fastify.post('/create', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado. Apenas usuários master podem criar escritórios.' });
    }

    const result = createOfficeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: result.error });
    }

    const office = await prisma.office.create({
      data: {
        name: result.data.name,
        logo: result.data.logo || '',
        primaryColor: result.data.primaryColor || '#3b82f6',
        workingHoursEnabled: result.data.workingHoursEnabled || false,
        workingHoursStart: result.data.workingHoursStart || '08:00',
        workingHoursEnd: result.data.workingHoursEnd || '18:00',
      },
    });

    return {
      id: office.id,
      name: office.name,
      logo: office.logo,
      primaryColor: office.primaryColor,
      workingHours: {
        enabled: office.workingHoursEnabled,
        start: office.workingHoursStart,
        end: office.workingHoursEnd,
      },
    };
  });

  // Update specific office (master only)
  fastify.put('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { id } = request.params as { id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado. Apenas usuários master podem editar escritórios.' });
    }

    const result = updateOfficeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const office = await prisma.office.update({
      where: { id },
      data: result.data,
    });

    return {
      id: office.id,
      name: office.name,
      logo: office.logo,
      primaryColor: office.primaryColor,
      workingHours: {
        enabled: office.workingHoursEnabled,
        start: office.workingHoursStart,
        end: office.workingHoursEnd,
      },
    };
  });

  // Delete office (master only)
  fastify.delete('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { id } = request.params as { id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado. Apenas usuários master podem deletar escritórios.' });
    }

    // Check if it's the default office
    if (id === 'default') {
      return reply.status(400).send({ error: 'Não é possível deletar o escritório padrão.' });
    }

    await prisma.office.delete({
      where: { id },
    });

    return { success: true, message: 'Escritório deletado com sucesso.' };
  });

  // Get office users (master only)
  fastify.get('/:id/users', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { id } = request.params as { id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const users = await prisma.user.findMany({
      where: { officeId: id },
      include: { sector: true },
    });

    return users.map(user => ({
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
    }));
  });
}
