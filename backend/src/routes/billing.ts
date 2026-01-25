import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const createBillingPlanSchema = z.object({
  officeId: z.string().uuid(),
  pricePerUser: z.number().min(0),
  customNotes: z.string().optional(),
});

const updateBillingPlanSchema = z.object({
  pricePerUser: z.number().min(0).optional(),
  customNotes: z.string().optional().nullable(),
});

const createPaymentSchema = z.object({
  billingPlanId: z.string().uuid(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  amount: z.number().min(0),
  userCount: z.number().min(0),
  status: z.enum(['pending', 'confirmed', 'overdue']).optional(),
  notes: z.string().optional(),
});

const updatePaymentSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'overdue']).optional(),
  notes: z.string().optional().nullable(),
  confirmedBy: z.string().optional().nullable(),
});

export async function billingRoutes(fastify: FastifyInstance) {
  // Get all billing plans (master only)
  fastify.get('/plans', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string; id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado. Apenas usuários master podem acessar planos de faturamento.' });
    }

    const plans = await prisma.billingPlan.findMany({
      include: {
        office: {
          include: {
            _count: {
              select: { users: true },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 12, // Last 12 months
        },
      },
    });

    return plans.map(plan => ({
      id: plan.id,
      officeId: plan.officeId,
      officeName: plan.office.name,
      officeLogo: plan.office.logo,
      pricePerUser: Number(plan.pricePerUser),
      customNotes: plan.customNotes,
      currentUserCount: plan.office._count.users,
      currentMonthlyTotal: Number(plan.pricePerUser) * plan.office._count.users,
      payments: plan.payments.map(p => ({
        id: p.id,
        month: p.month,
        year: p.year,
        amount: Number(p.amount),
        userCount: p.userCount,
        status: p.status,
        confirmedAt: p.confirmedAt,
        confirmedBy: p.confirmedBy,
        notes: p.notes,
        createdAt: p.createdAt,
      })),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));
  });

  // Get billing plan by office ID (master only)
  fastify.get('/plans/office/:officeId', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { officeId } = request.params as { officeId: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const plan = await prisma.billingPlan.findUnique({
      where: { officeId },
      include: {
        office: {
          include: {
            _count: { select: { users: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!plan) {
      return reply.status(404).send({ error: 'Plano de faturamento não encontrado.' });
    }

    return {
      id: plan.id,
      officeId: plan.officeId,
      officeName: plan.office.name,
      pricePerUser: Number(plan.pricePerUser),
      customNotes: plan.customNotes,
      currentUserCount: plan.office._count.users,
      payments: plan.payments.map(p => ({
        id: p.id,
        month: p.month,
        year: p.year,
        amount: Number(p.amount),
        userCount: p.userCount,
        status: p.status,
        confirmedAt: p.confirmedAt,
        confirmedBy: p.confirmedBy,
        notes: p.notes,
      })),
    };
  });

  // Create billing plan (master only)
  fastify.post('/plans', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const result = createBillingPlanSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: result.error });
    }

    // Check if office exists
    const office = await prisma.office.findUnique({
      where: { id: result.data.officeId },
    });

    if (!office) {
      return reply.status(404).send({ error: 'Escritório não encontrado.' });
    }

    // Check if plan already exists for this office
    const existingPlan = await prisma.billingPlan.findUnique({
      where: { officeId: result.data.officeId },
    });

    if (existingPlan) {
      return reply.status(400).send({ error: 'Já existe um plano de faturamento para este escritório.' });
    }

    const plan = await prisma.billingPlan.create({
      data: {
        officeId: result.data.officeId,
        pricePerUser: result.data.pricePerUser,
        customNotes: result.data.customNotes,
      },
      include: {
        office: true,
      },
    });

    return {
      id: plan.id,
      officeId: plan.officeId,
      officeName: plan.office.name,
      pricePerUser: Number(plan.pricePerUser),
      customNotes: plan.customNotes,
    };
  });

  // Update billing plan (master only)
  fastify.put('/plans/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { id } = request.params as { id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const result = updateBillingPlanSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const plan = await prisma.billingPlan.update({
      where: { id },
      data: result.data,
      include: { office: true },
    });

    return {
      id: plan.id,
      officeId: plan.officeId,
      officeName: plan.office.name,
      pricePerUser: Number(plan.pricePerUser),
      customNotes: plan.customNotes,
    };
  });

  // Delete billing plan (master only)
  fastify.delete('/plans/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { id } = request.params as { id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    await prisma.billingPlan.delete({
      where: { id },
    });

    return { success: true };
  });

  // Get payments for a billing plan (master only)
  fastify.get('/payments/plan/:planId', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { planId } = request.params as { planId: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const payments = await prisma.payment.findMany({
      where: { billingPlanId: planId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        billingPlan: {
          include: { office: true },
        },
      },
    });

    return payments.map(p => ({
      id: p.id,
      month: p.month,
      year: p.year,
      amount: Number(p.amount),
      userCount: p.userCount,
      status: p.status,
      confirmedAt: p.confirmedAt,
      confirmedBy: p.confirmedBy,
      notes: p.notes,
      officeName: p.billingPlan.office.name,
    }));
  });

  // Create payment record (master only)
  fastify.post('/payments', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string; id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const result = createPaymentSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: result.error });
    }

    // Check if payment already exists for this month/year
    const existingPayment = await prisma.payment.findUnique({
      where: {
        billingPlanId_month_year: {
          billingPlanId: result.data.billingPlanId,
          month: result.data.month,
          year: result.data.year,
        },
      },
    });

    if (existingPayment) {
      return reply.status(400).send({ error: 'Já existe um registro de pagamento para este mês/ano.' });
    }

    const payment = await prisma.payment.create({
      data: {
        billingPlanId: result.data.billingPlanId,
        month: result.data.month,
        year: result.data.year,
        amount: result.data.amount,
        userCount: result.data.userCount,
        status: result.data.status || 'pending',
        notes: result.data.notes,
      },
    });

    return {
      id: payment.id,
      month: payment.month,
      year: payment.year,
      amount: Number(payment.amount),
      userCount: payment.userCount,
      status: payment.status,
      notes: payment.notes,
    };
  });

  // Update payment status (master only)
  fastify.put('/payments/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const result = updatePaymentSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const updateData: any = { ...result.data };

    // If confirming payment, set confirmedAt and confirmedBy
    if (result.data.status === 'confirmed') {
      updateData.confirmedAt = new Date();
      updateData.confirmedBy = currentUser.id;
    }

    const payment = await prisma.payment.update({
      where: { id },
      data: updateData,
    });

    return {
      id: payment.id,
      month: payment.month,
      year: payment.year,
      amount: Number(payment.amount),
      userCount: payment.userCount,
      status: payment.status,
      confirmedAt: payment.confirmedAt,
      confirmedBy: payment.confirmedBy,
      notes: payment.notes,
    };
  });

  // Delete payment (master only)
  fastify.delete('/payments/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };
    const { id } = request.params as { id: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    await prisma.payment.delete({
      where: { id },
    });

    return { success: true };
  });

  // Get billing summary/statistics (master only)
  fastify.get('/summary', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all billing plans with office info
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

    // Calculate totals
    let totalMRR = 0;
    let totalConfirmedThisMonth = 0;
    let totalPendingThisMonth = 0;
    let officesWithPlans = 0;

    plans.forEach(plan => {
      const mrr = Number(plan.pricePerUser) * plan.office._count.users;
      totalMRR += mrr;
      officesWithPlans++;

      const currentPayment = plan.payments[0];
      if (currentPayment) {
        if (currentPayment.status === 'confirmed') {
          totalConfirmedThisMonth += Number(currentPayment.amount);
        } else if (currentPayment.status === 'pending') {
          totalPendingThisMonth += Number(currentPayment.amount);
        }
      }
    });

    // Get total offices
    const totalOffices = await prisma.office.count();

    return {
      totalOffices,
      officesWithPlans,
      totalMRR,
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        totalConfirmed: totalConfirmedThisMonth,
        totalPending: totalPendingThisMonth,
        totalExpected: totalMRR,
      },
    };
  });

  // Generate payment for current month for all offices (master only)
  fastify.post('/payments/generate-current-month', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { role: string };

    if (currentUser.role !== 'master') {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const plans = await prisma.billingPlan.findMany({
      include: {
        office: {
          include: {
            _count: { select: { users: true } },
          },
        },
      },
    });

    const createdPayments = [];

    for (const plan of plans) {
      // Check if payment already exists
      const existingPayment = await prisma.payment.findUnique({
        where: {
          billingPlanId_month_year: {
            billingPlanId: plan.id,
            month: currentMonth,
            year: currentYear,
          },
        },
      });

      if (!existingPayment) {
        const userCount = plan.office._count.users;
        const amount = Number(plan.pricePerUser) * userCount;

        const payment = await prisma.payment.create({
          data: {
            billingPlanId: plan.id,
            month: currentMonth,
            year: currentYear,
            amount,
            userCount,
            status: 'pending',
          },
        });

        createdPayments.push({
          id: payment.id,
          officeName: plan.office.name,
          amount: Number(payment.amount),
          userCount: payment.userCount,
        });
      }
    }

    return {
      created: createdPayments.length,
      payments: createdPayments,
    };
  });
}
