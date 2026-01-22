import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';

const createChannelSchema = z.object({
  type: z.enum(['dm', 'group']),
  name: z.string().optional(),
  participantIds: z.array(z.string()),
});

const sendMessageSchema = z.object({
  text: z.string().min(1),
  mentions: z.array(z.string()).default([]),
});

export async function channelRoutes(fastify: FastifyInstance) {
  // Get user's channels
  fastify.get('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request) => {
    const currentUser = request.user as { id: string };

    const channels = await prisma.chatChannel.findMany({
      where: {
        members: { some: { userId: currentUser.id } },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, status: true },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return channels.map((channel) => ({
      id: channel.id,
      type: channel.type,
      name: channel.name,
      participants: channel.members.map((m) => m.user),
      lastMessage: channel.messages[0] || null,
      updatedAt: channel.updatedAt,
    }));
  });

  // Create or get DM channel
  fastify.post('/', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const currentUser = request.user as { id: string };

    const result = createChannelSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    const { type, name, participantIds } = result.data;
    const allParticipants = [...new Set([...participantIds, currentUser.id])];

    // For DM, check if channel already exists
    if (type === 'dm' && allParticipants.length === 2) {
      const existingChannel = await prisma.chatChannel.findFirst({
        where: {
          type: 'dm',
          AND: allParticipants.map((id) => ({
            members: { some: { userId: id } },
          })),
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, avatar: true } },
            },
          },
        },
      });

      if (existingChannel) {
        return {
          id: existingChannel.id,
          type: existingChannel.type,
          name: existingChannel.name,
          participants: existingChannel.members.map((m) => m.user),
        };
      }
    }

    const channel = await prisma.chatChannel.create({
      data: {
        type,
        name: type === 'group' ? name : null,
        members: {
          create: allParticipants.map((userId) => ({ userId })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    return {
      id: channel.id,
      type: channel.type,
      name: channel.name,
      participants: channel.members.map((m) => m.user),
    };
  });

  // Get channel messages
  fastify.get('/:id/messages', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };
    const { limit = '50', before } = request.query as { limit?: string; before?: string };

    // Verify user is member
    const membership = await prisma.channelMember.findUnique({
      where: {
        userId_channelId: { userId: currentUser.id, channelId: id },
      },
    });

    if (!membership) {
      return reply.status(403).send({ error: 'Not a member of this channel' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        channelId: id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        readBy: { select: { userId: true } },
      },
    });

    return messages.reverse().map((msg) => ({
      id: msg.id,
      text: msg.text,
      senderId: msg.senderId,
      sender: msg.sender,
      timestamp: msg.createdAt,
      editedAt: msg.editedAt,
      mentions: msg.mentions,
      readBy: msg.readBy.map((r) => r.userId),
    }));
  });

  // Send message
  fastify.post('/:id/messages', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    const result = sendMessageSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid data' });
    }

    // Verify user is member
    const membership = await prisma.channelMember.findUnique({
      where: {
        userId_channelId: { userId: currentUser.id, channelId: id },
      },
    });

    if (!membership) {
      return reply.status(403).send({ error: 'Not a member of this channel' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        text: result.data.text,
        mentions: result.data.mentions,
        senderId: currentUser.id,
        channelId: id,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Update channel timestamp
    await prisma.chatChannel.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return {
      id: message.id,
      text: message.text,
      senderId: message.senderId,
      sender: message.sender,
      timestamp: message.createdAt,
      mentions: message.mentions,
      readBy: [currentUser.id],
    };
  });

  // Mark messages as read
  fastify.post('/:id/read', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };

    // Get all unread messages
    const unreadMessages = await prisma.chatMessage.findMany({
      where: {
        channelId: id,
        NOT: {
          readBy: { some: { userId: currentUser.id } },
        },
      },
    });

    // Mark them as read
    await prisma.messageRead.createMany({
      data: unreadMessages.map((msg) => ({
        userId: currentUser.id,
        messageId: msg.id,
      })),
      skipDuplicates: true,
    });

    return { success: true, count: unreadMessages.length };
  });
}
