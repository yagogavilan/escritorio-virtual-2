import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

interface UseSocketOptions {
  onUsersInitialState?: (data: { users: Array<{ id: string; status: string; statusMessage?: string; currentRoomId?: string | null }> }) => void;
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
  onTaskMentioned?: (data: { taskId: string; taskTitle: string; commentId: string; mentionedBy: string; mentionedByName: string }) => void;
  onAnnouncementNew?: (data: { announcement: any }) => void;
  onCallIncoming?: (data: { callerId: string; type: 'audio' | 'video' }) => void;
  onCallAccepted?: (data: { acceptedBy: string }) => void;
  onCallRejected?: (data: { rejectedBy: string }) => void;
  onCallEnded?: (data: { endedBy: string }) => void;
}

export function useSocket(options: UseSocketOptions = {}, forceReconnectKey?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Store callbacks in refs to avoid recreating socket on every callback change
  const callbacksRef = useRef(options);

  // Always update callbacks ref (doesn't cause re-render)
  callbacksRef.current = options;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[Socket] No token found, skipping connection');
      return;
    }

    console.log('[Socket] Connecting to:', SOCKET_URL, 'with path: /api/socket.io');

    const socket = io(SOCKET_URL, {
      path: '/api/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected successfully! Socket ID:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected. Reason:', reason);
      setIsConnected(false);
    });

    socket.on('error', (error: { message: string }) => {
      console.error('[Socket] Error:', error.message);
    });

    // Initial state
    socket.on('users:initial_state', (data) => {
      console.log('[Socket] Received initial state:', data);
      callbacksRef.current.onUsersInitialState?.(data);
    });

    // Presence events
    socket.on('user:online', (data) => {
      console.log('[Socket] User came online:', data);
      callbacksRef.current.onUserOnline?.(data);
    });

    socket.on('user:offline', (data) => {
      console.log('[Socket] User went offline:', data);
      callbacksRef.current.onUserOffline?.(data);
    });

    socket.on('user:status_changed', (data) => {
      console.log('[Socket] User status changed:', data);
      callbacksRef.current.onUserStatusChanged?.(data);
    });

    // Room events
    socket.on('room:user_joined', (data) => {
      console.log('[Socket] User joined room:', data);
      callbacksRef.current.onRoomUserJoined?.(data);
    });

    socket.on('room:user_left', (data) => {
      console.log('[Socket] User left room:', data);
      callbacksRef.current.onRoomUserLeft?.(data);
    });

    socket.on('room:knocked', (data) => {
      console.log('[Socket] Room knocked:', data);
      callbacksRef.current.onRoomKnocked?.(data);
    });

    // Chat events
    socket.on('chat:new_message', (data) => {
      callbacksRef.current.onChatNewMessage?.(data);
    });

    socket.on('chat:typing', (data) => {
      callbacksRef.current.onChatTyping?.(data);
    });

    // Task events
    socket.on('task:created', (data) => {
      callbacksRef.current.onTaskCreated?.(data);
    });

    socket.on('task:updated', (data) => {
      callbacksRef.current.onTaskUpdated?.(data);
    });

    socket.on('task:assigned', (data) => {
      callbacksRef.current.onTaskAssigned?.(data);
    });

    socket.on('task:mentioned', (data) => {
      callbacksRef.current.onTaskMentioned?.(data);
    });

    // Announcement events
    socket.on('announcement:new', (data) => {
      callbacksRef.current.onAnnouncementNew?.(data);
    });

    // Call events
    socket.on('call:incoming', (data) => {
      callbacksRef.current.onCallIncoming?.(data);
    });

    socket.on('call:accepted', (data) => {
      callbacksRef.current.onCallAccepted?.(data);
    });

    socket.on('call:rejected', (data) => {
      callbacksRef.current.onCallRejected?.(data);
    });

    socket.on('call:ended', (data) => {
      callbacksRef.current.onCallEnded?.(data);
    });

    // Handle browser/tab close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('[Socket] Browser closing, emitting user:disconnect');
      // Emit disconnect event to server
      socket.emit('user:disconnect');
      // Disconnect socket immediately
      socket.disconnect();
      // Remove token to force logout on next load
      localStorage.removeItem('token');
    };

    // Handle visibility change (when user switches tabs or minimizes)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Socket] Page hidden');
        // Optionally emit away status
        socket.emit('user:status_change', { status: 'away' });
      } else {
        console.log('[Socket] Page visible');
        // User is back
        socket.emit('user:status_change', { status: 'online' });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      console.log('[Socket] Cleanup called! Stack trace:', new Error().stack);
      console.log('[Socket] forceReconnectKey:', forceReconnectKey);

      // Remove event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      socket.disconnect();
      socketRef.current = null;
    };
  }, [forceReconnectKey]); // Only reconnect when forceReconnectKey changes

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
