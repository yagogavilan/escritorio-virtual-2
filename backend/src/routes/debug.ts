import { FastifyInstance } from 'fastify';
import { prisma } from '../index.js';

export async function debugRoutes(fastify: FastifyInstance) {
  // Get all users with their current status
  fastify.get('/users', async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        statusMessage: true,
        currentRoomId: true,
        officeId: true,
        sectorId: true,
      },
      orderBy: { email: 'asc' },
    });

    const offices = await prisma.office.findMany({
      select: { id: true, name: true },
    });

    return {
      timestamp: new Date().toISOString(),
      users,
      offices,
      usersByOffice: offices.map(office => ({
        officeId: office.id,
        officeName: office.name,
        users: users.filter(u => u.officeId === office.id),
      })),
    };
  });

  // Get current WebSocket connections (we'll need to track this)
  fastify.get('/connections', async () => {
    return {
      message: 'WebSocket connection tracking not yet implemented',
      timestamp: new Date().toISOString(),
    };
  });
}
