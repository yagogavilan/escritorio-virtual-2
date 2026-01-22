import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

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
  }, async () => {
    let office = await prisma.office.findFirst();

    if (!office) {
      office = await prisma.office.create({
        data: {
          name: 'Nexus Office',
          logo: '',
          primaryColor: '#3b82f6',
        },
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
}
