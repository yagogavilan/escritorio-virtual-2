import { FastifyInstance } from 'fastify';
import { prisma } from '../index.js';

export async function analyticsRoutes(fastify: FastifyInstance) {
  // Get general statistics (master only)
  fastify.get('/stats', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const [totalOffices, totalUsers, totalOnlineUsers, totalRooms] = await Promise.all([
      prisma.office.count(),
      prisma.user.count({ where: { role: { not: 'visitor' } } }),
      prisma.user.count({ where: { status: { in: ['online', 'busy', 'away', 'in_meeting'] } } }),
      prisma.room.count(),
    ]);

    return {
      totalOffices,
      totalUsers,
      totalOnlineUsers,
      totalRooms,
    };
  });

  // Get users by office (master only)
  fastify.get('/users-by-office', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const offices = await prisma.office.findMany({
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return offices.map(office => ({
      officeId: office.id,
      officeName: office.name,
      totalUsers: office._count.users,
    }));
  });

  // Get online hours by office (master only)
  fastify.get('/online-hours', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { officeId, startDate, endDate } = request.query as {
      officeId?: string;
      startDate?: string;
      endDate?: string;
    };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const whereClause: any = {
      action: { in: ['login', 'logout', 'status_change'] },
    };

    if (officeId) {
      whereClause.officeId = officeId;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const activityLogs = await prisma.activityLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    });

    // Calculate online hours by grouping logs per user
    const userSessions: { [userId: string]: { loginTime: Date | null; totalHours: number } } = {};

    activityLogs.forEach(log => {
      if (!userSessions[log.userId]) {
        userSessions[log.userId] = { loginTime: null, totalHours: 0 };
      }

      const metadata = log.metadata as any;

      if (log.action === 'login' || (log.action === 'status_change' && metadata?.status === 'online')) {
        userSessions[log.userId].loginTime = log.createdAt;
      } else if (log.action === 'logout' || (log.action === 'status_change' && metadata?.status === 'offline')) {
        if (userSessions[log.userId].loginTime) {
          const duration = (log.createdAt.getTime() - userSessions[log.userId].loginTime!.getTime()) / (1000 * 60 * 60);
          userSessions[log.userId].totalHours += duration;
          userSessions[log.userId].loginTime = null;
        }
      }
    });

    // Sum total hours
    const totalHours = Object.values(userSessions).reduce((sum, session) => sum + session.totalHours, 0);

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      userCount: Object.keys(userSessions).length,
      averageHoursPerUser: Object.keys(userSessions).length > 0
        ? Math.round((totalHours / Object.keys(userSessions).length) * 100) / 100
        : 0,
    };
  });

  // Get MRR and revenue (master only)
  fastify.get('/revenue', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all billing plans
    const plans = await prisma.billingPlan.findMany({
      include: {
        office: {
          include: {
            _count: { select: { users: true } },
          },
        },
        payments: {
          where: {
            month: currentMonth,
            year: currentYear,
          },
        },
      },
    });

    let totalMRR = 0;
    let confirmedRevenue = 0;
    let pendingRevenue = 0;

    plans.forEach(plan => {
      const mrr = Number(plan.pricePerUser) * plan.office._count.users;
      totalMRR += mrr;

      const currentPayment = plan.payments[0];
      if (currentPayment) {
        if (currentPayment.status === 'confirmed') {
          confirmedRevenue += Number(currentPayment.amount);
        } else if (currentPayment.status === 'pending') {
          pendingRevenue += Number(currentPayment.amount);
        }
      }
    });

    return {
      mrr: totalMRR,
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        confirmed: confirmedRevenue,
        pending: pendingRevenue,
        total: confirmedRevenue + pendingRevenue,
      },
    };
  });

  // Get login activity by period (master only)
  fastify.get('/login-activity', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { period = 'week', officeId } = request.query as {
      period?: 'day' | 'week' | 'month';
      officeId?: string;
    };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const whereClause: any = {
      action: 'login',
      createdAt: {
        gte: startDate,
        lte: now,
      },
    };

    if (officeId) {
      whereClause.officeId = officeId;
    }

    const loginLogs = await prisma.activityLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const loginsByDate: { [date: string]: number } = {};

    loginLogs.forEach(log => {
      const dateKey = log.createdAt.toISOString().split('T')[0];
      loginsByDate[dateKey] = (loginsByDate[dateKey] || 0) + 1;
    });

    // Convert to array format
    const result = Object.entries(loginsByDate).map(([date, count]) => ({
      date,
      logins: count,
    }));

    return result;
  });

  // Get engagement by sector (master only)
  fastify.get('/engagement-by-sector', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { officeId, startDate, endDate } = request.query as {
      officeId?: string;
      startDate?: string;
      endDate?: string;
    };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    // Get sectors with user count
    const whereClause: any = {};
    if (officeId) {
      whereClause.officeId = officeId;
    }

    const sectors = await prisma.sector.findMany({
      where: whereClause,
      include: {
        users: true,
        _count: {
          select: { users: true },
        },
      },
    });

    // For each sector, calculate engagement based on activity logs
    const result = await Promise.all(
      sectors.map(async sector => {
        const userIds = sector.users.map(u => u.id);

        const activityWhere: any = {
          userId: { in: userIds },
        };

        if (startDate && endDate) {
          activityWhere.createdAt = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }

        const activityCount = await prisma.activityLog.count({
          where: activityWhere,
        });

        // Calculate online users in this sector
        const onlineUsers = sector.users.filter(u =>
          ['online', 'busy', 'away', 'in_meeting'].includes(u.status)
        ).length;

        return {
          sectorId: sector.id,
          sectorName: sector.name,
          totalUsers: sector._count.users,
          onlineUsers,
          activityCount,
          engagementScore: sector._count.users > 0
            ? Math.round((activityCount / sector._count.users) * 100) / 100
            : 0,
        };
      })
    );

    return result;
  });

  // Get activity summary (master only)
  fastify.get('/activity-summary', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { startDate, endDate } = request.query as {
      startDate?: string;
      endDate?: string;
    };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [totalActivities, loginCount, messageCount, taskCount] = await Promise.all([
      prisma.activityLog.count({ where: whereClause }),
      prisma.activityLog.count({ where: { ...whereClause, action: 'login' } }),
      prisma.activityLog.count({ where: { ...whereClause, action: 'send_message' } }),
      prisma.activityLog.count({ where: { ...whereClause, action: 'create_task' } }),
    ]);

    return {
      totalActivities,
      loginCount,
      messageCount,
      taskCount,
    };
  });

  // Get current users online (master only)
  fastify.get('/users-online', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { officeId } = request.query as { officeId?: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const whereClause: any = {
      status: { in: ['online', 'busy', 'away', 'in_meeting'] },
      role: { not: 'visitor' },
    };

    if (officeId) {
      whereClause.officeId = officeId;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        office: true,
        sector: true,
      },
    });

    return users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      jobTitle: user.jobTitle,
      officeName: user.office?.name,
      sectorName: user.sector?.name,
    }));
  });
}
