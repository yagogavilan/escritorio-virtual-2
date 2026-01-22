import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

interface UseSocketOptions {
  onUserOnline?: (data: { userId: string }) => void;
  onUserOffline?: (data: { userId: string }) => void;
  onUserStatusChanged?: (data: { userId: string; status: string; statusMessage?: string; currentRoomId?: string | null }) => void;
  onRoomUserJoined?: (data: { roomId: string; userId: string }) => void;
  onRoomUserLeft?: (data: { roomId: string; userId: string }) => void;
  onRoomKnocked?: (data: { roomId: string; user: { id: string; name: string; avatar: string } }) => void;
  onChatNewMessage?: (data: { channelId: string; message: any }) => void;
  onChatTyping?: (data: { channelId: string; userId: string; isTyping: boolean }) => void;
  onTaskCreated?: (data: { task: any; createdBy: string }) => void;
  onTaskUpdated?: (data: { task: any; updatedBy: string }) => void;
  onTaskAssigned?: (data: { taskId: string; assignedBy: string }) => void;
  onAnnouncementNew?: (data: { announcement: any }) => void;
  onCallIncoming?: (data: { callerId: string; type: 'audio' | 'video' }) => void;
  onCallAccepted?: (data: { acceptedBy: string }) => void;
  onCallRejected?: (data: { rejectedBy: string }) => void;
  onCallEnded?: (data: { endedBy: string }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      path: '/api/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
    });

    // Presence events
    if (options.onUserOnline) {
      socket.on('user:online', options.onUserOnline);
    }
    if (options.onUserOffline) {
      socket.on('user:offline', options.onUserOffline);
    }
    if (options.onUserStatusChanged) {
      socket.on('user:status_changed', options.onUserStatusChanged);
    }

    // Room events
    if (options.onRoomUserJoined) {
      socket.on('room:user_joined', options.onRoomUserJoined);
    }
    if (options.onRoomUserLeft) {
      socket.on('room:user_left', options.onRoomUserLeft);
    }
    if (options.onRoomKnocked) {
      socket.on('room:knocked', options.onRoomKnocked);
    }

    // Chat events
    if (options.onChatNewMessage) {
      socket.on('chat:new_message', options.onChatNewMessage);
    }
    if (options.onChatTyping) {
      socket.on('chat:typing', options.onChatTyping);
    }

    // Task events
    if (options.onTaskCreated) {
      socket.on('task:created', options.onTaskCreated);
    }
    if (options.onTaskUpdated) {
      socket.on('task:updated', options.onTaskUpdated);
    }
    if (options.onTaskAssigned) {
      socket.on('task:assigned', options.onTaskAssigned);
    }

    // Announcement events
    if (options.onAnnouncementNew) {
      socket.on('announcement:new', options.onAnnouncementNew);
    }

    // Call events
    if (options.onCallIncoming) {
      socket.on('call:incoming', options.onCallIncoming);
    }
    if (options.onCallAccepted) {
      socket.on('call:accepted', options.onCallAccepted);
    }
    if (options.onCallRejected) {
      socket.on('call:rejected', options.onCallRejected);
    }
    if (options.onCallEnded) {
      socket.on('call:ended', options.onCallEnded);
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Emit functions
  const changeStatus = useCallback((status: string, statusMessage?: string) => {
    socketRef.current?.emit('user:status_change', { status, statusMessage });
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('room:join', { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('room:leave', { roomId });
  }, []);

  const knockRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('room:knock', { roomId });
  }, []);

  const sendMessage = useCallback((channelId: string, text: string, mentions?: string[]) => {
    socketRef.current?.emit('chat:message', { channelId, text, mentions });
  }, []);

  const setTyping = useCallback((channelId: string, isTyping: boolean) => {
    socketRef.current?.emit('chat:typing', { channelId, isTyping });
  }, []);

  const emitTaskCreated = useCallback((task: any) => {
    socketRef.current?.emit('task:created', { task });
  }, []);

  const emitTaskUpdated = useCallback((task: any) => {
    socketRef.current?.emit('task:updated', { task });
  }, []);

  const emitTaskAssigned = useCallback((taskId: string, assigneeId: string) => {
    socketRef.current?.emit('task:assigned', { taskId, assigneeId });
  }, []);

  const emitAnnouncement = useCallback((announcement: any) => {
    socketRef.current?.emit('announcement:new', { announcement });
  }, []);

  const initiateCall = useCallback((targetUserId: string, type: 'audio' | 'video') => {
    socketRef.current?.emit('call:initiate', { targetUserId, type });
  }, []);

  const acceptCall = useCallback((callerId: string) => {
    socketRef.current?.emit('call:accept', { callerId });
  }, []);

  const rejectCall = useCallback((callerId: string) => {
    socketRef.current?.emit('call:reject', { callerId });
  }, []);

  const endCall = useCallback((participantIds: string[]) => {
    socketRef.current?.emit('call:end', { participantIds });
  }, []);

  return {
    isConnected,
    changeStatus,
    joinRoom,
    leaveRoom,
    knockRoom,
    sendMessage,
    setTyping,
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskAssigned,
    emitAnnouncement,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
