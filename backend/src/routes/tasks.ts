import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assigneeId: z.string(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const addCommentSchema = z.object({
  text: z.string().min(1),
  mentions: z.array(z.string()).default([]),
});

export async function taskRoutes(fastify: FastifyInstance) {
  // Get all tasks
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request) => {
    const { status, assigneeId } = request.query as { status?: string; assigneeId?: string };

    const tasks = await prisma.task.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(assigneeId ? { assigneeId } : {}),
      },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        comments: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assignee: task.assignee,
      creatorId: task.creatorId,
      creator: task.creator,
      dueDate: task.dueDate,
      tags: task.tags,
      commentCount: task._count.comments,
      recentComments: task.comments,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  });

  // Get single task
  fastify.get('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        attachments: true,
      },
    });

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assignee: task.assignee,
      creatorId: task.creatorId,
      creator: task.creator,
      dueDate: task.dueDate,
      tags: task.tags,
      comments: task.comments.map((c) => ({
        id: c.id,
        userId: c.userId,
        user: c.user,
        text: c.text,
        mentions: c.mentions,
        createdAt: c.createdAt,
      })),
      history: task.history,
      attachments: task.attachments,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  });

  // Create task
  fastify.post('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string };

    const result = createTaskSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data', details: result.error });
    }

    const task = await prisma.task.create({
      data: {
        ...result.data,
        dueDate: result.data.dueDate ? new Date(result.data.dueDate) : null,
        creatorId: currentUser.id,
        history: {
          create: {
            action: 'created task',
            userId: currentUser.id,
          },
        },
      },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assignee: task.assignee,
      creatorId: task.creatorId,
      creator: task.creator,
      dueDate: task.dueDate,
      tags: task.tags,
      createdAt: task.createdAt,
    };
  });

  // Update task
  fastify.put('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    const result = updateTaskSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    // Build history entries
    const historyEntries: { action: string; userId: string }[] = [];
    if (result.data.status && result.data.status !== existingTask.status) {
      historyEntries.push({
        action: `changed status to ${result.data.status}`,
        userId: currentUser.id,
      });
    }
    if (result.data.assigneeId && result.data.assigneeId !== existingTask.assigneeId) {
      historyEntries.push({
        action: `reassigned task`,
        userId: currentUser.id,
      });
    }
    if (result.data.priority && result.data.priority !== existingTask.priority) {
      historyEntries.push({
        action: `changed priority to ${result.data.priority}`,
        userId: currentUser.id,
      });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...result.data,
        dueDate: result.data.dueDate === null ? null : result.data.dueDate ? new Date(result.data.dueDate) : undefined,
        history: {
          create: historyEntries,
        },
      },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assignee: task.assignee,
      creatorId: task.creatorId,
      creator: task.creator,
      dueDate: task.dueDate,
      tags: task.tags,
      updatedAt: task.updatedAt,
    };
  });

  // Delete task (only admin/master)
  fastify.delete('/:id', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string; role: string };

    // Only admin or master can delete
    if (!['admin', 'master'].includes(currentUser.role)) {
      return reply.status(403).send({ error: 'Forbidden: Only administrators can delete tasks' });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    await prisma.task.delete({ where: { id } });

    return { success: true };
  });

  // Add comment
  fastify.post('/:id/comments', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    const result = addCommentSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignee: true }
    });
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    const comment = await prisma.taskComment.create({
      data: {
        text: result.data.text,
        mentions: result.data.mentions,
        taskId: id,
        userId: currentUser.id,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Add history entry
    await prisma.taskHistory.create({
      data: {
        action: 'added a comment',
        taskId: id,
        userId: currentUser.id,
      },
    });

    // Notify mentioned users via WebSocket (if available)
    if (result.data.mentions && result.data.mentions.length > 0) {
      const io = (fastify as any).io;
      if (io) {
        result.data.mentions.forEach((mentionedUserId: string) => {
          if (mentionedUserId !== currentUser.id) {
            io.to(`user:${mentionedUserId}`).emit('task:mentioned', {
              taskId: id,
              taskTitle: task.title,
              commentId: comment.id,
              mentionedBy: currentUser.id,
              mentionedByName: comment.user.name,
            });
          }
        });
      }
    }

    return {
      id: comment.id,
      text: comment.text,
      userId: comment.userId,
      user: comment.user,
      mentions: comment.mentions,
      createdAt: comment.createdAt,
    };
  });
}
