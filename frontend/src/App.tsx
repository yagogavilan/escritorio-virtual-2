import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { User, UserStatus, Room, Office, VisitorInvite, Sector } from './types';
import { ArrowRight, Layers, LayoutGrid, ShieldCheck, Phone, PhoneIncoming, X, Check, Clock, Lock, Ticket, Briefcase, Loader2, UserCircle } from 'lucide-react';
import { authApi, usersApi, officeApi, sectorsApi, roomsApi, invitesApi } from './api/client';
import { useSocket } from './hooks/useSocket';
import { ToastContainer, Toast, useToast } from './components/ToastNotification';
import { MediaProvider } from './contexts/MediaContext';

// Lazy load heavy components for better initial load performance
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const OfficeView = lazy(() => import('./components/OfficeView').then(module => ({ default: module.OfficeView })));
const VideoModal = lazy(() => import('./components/VideoModal').then(module => ({ default: module.VideoModal })));
const MediaPreviewModal = lazy(() => import('./components/MediaPreviewModal').then(module => ({ default: module.MediaPreviewModal })));
const MinimizedCall = lazy(() => import('./components/MinimizedCall').then(module => ({ default: module.MinimizedCall })));

// Loading component for Suspense fallback
const ComponentLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      <p className="text-slate-400">Carregando componente...</p>
    </div>
  </div>
);

const MASTER_EMAIL = import.meta.env.VITE_MASTER_EMAIL || 'admin@example.com';

export default function App() {
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'login' | 'admin' | 'office' | 'closed'>('login');

  // Office data from API
  const [officeData, setOfficeData] = useState<Office>({
    id: 'default',
    name: 'Nexus Office',
    logo: '',
    primaryColor: '#3b82f6',
    workingHours: { enabled: false, start: '08:00', end: '18:00' },
    visitorInvites: [],
    users: [],
    rooms: [],
    sectors: []
  });

  const [activeCall, setActiveCall] = useState<{ roomName: string, participants: User[], roomId?: string } | null>(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ caller: User, roomId?: string } | null>(null);
  const [pendingRoomJoin, setPendingRoomJoin] = useState<Room | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useToast(setToasts);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Audio refs
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Login Form State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginMode, setLoginMode] = useState<'employee' | 'visitor'>('employee');
  const [visitorName, setVisitorName] = useState('');
  const [visitorCode, setVisitorCode] = useState('');

  // Socket handlers
  const handleUsersInitialState = useCallback((data: { users: Array<{ id: string; status: string; statusMessage?: string; currentRoomId?: string | null }> }) => {
    console.log('[App] Handling initial state:', data);
    setOfficeData(prev => ({
      ...prev,
      users: prev.users.map(u => {
        const onlineUser = data.users.find(ou => ou.id === u.id);
        if (onlineUser) {
          return {
            ...u,
            status: onlineUser.status as UserStatus,
            statusMessage: onlineUser.statusMessage,
            currentRoomId: onlineUser.currentRoomId || undefined
          };
        }
        return u;
      })
    }));
  }, []);

  const handleUserOnline = useCallback((data: { userId: string }) => {
    console.log('[App] User came online:', data.userId);
    setOfficeData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === data.userId ? { ...u, status: 'online' as UserStatus } : u)
    }));

    // Atualizar currentUser se for o próprio usuário
    setCurrentUser(prev => prev && prev.id === data.userId ? { ...prev, status: 'online' as UserStatus } : prev);
  }, []);

  const handleUserOffline = useCallback((data: { userId: string }) => {
    console.log('[App] User went offline:', data.userId);
    setOfficeData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === data.userId ? { ...u, status: 'offline' as UserStatus } : u)
    }));

    // Atualizar currentUser se for o próprio usuário
    setCurrentUser(prev => prev && prev.id === data.userId ? { ...prev, status: 'offline' as UserStatus } : prev);
  }, []);

  const handleUserStatusChanged = useCallback((data: { userId: string; status: string; statusMessage?: string; currentRoomId?: string | null }) => {
    setOfficeData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === data.userId ? {
        ...u,
        status: data.status as UserStatus,
        statusMessage: data.statusMessage,
        currentRoomId: data.currentRoomId || undefined
      } : u)
    }));

    // Atualizar currentUser se for o próprio usuário
    setCurrentUser(prev => prev && prev.id === data.userId ? {
      ...prev,
      status: data.status as UserStatus,
      statusMessage: data.statusMessage,
      currentRoomId: data.currentRoomId || undefined
    } : prev);
  }, []);

  const handleRoomUserJoined = useCallback((data: { roomId: string; userId: string }) => {
    setOfficeData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === data.roomId ? {
        ...r,
        participants: [...r.participants, data.userId]
      } : r)
    }));
  }, []);

  const handleRoomUserLeft = useCallback((data: { roomId: string; userId: string }) => {
    setOfficeData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === data.roomId ? {
        ...r,
        participants: r.participants.filter(pid => pid !== data.userId)
      } : r)
    }));
  }, []);

  const handleRoomKnocked = useCallback((data: { roomId: string; user: { id: string; name: string; avatar: string } }) => {
    toast.info(`${data.user.name} bateu na porta...`);

    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, [toast]);

  const handleCallIncoming = useCallback((data: { callerId: string; type: 'audio' | 'video' }) => {
    const caller = officeData.users.find(u => u.id === data.callerId);
    if (caller) {
      setIncomingCall({ caller });
    }
  }, [officeData.users]);

  const handleTaskMentioned = useCallback((data: { taskId: string; taskTitle: string; commentId: string; mentionedBy: string; mentionedByName: string }) => {
    toast.info(`${data.mentionedByName} mencionou você em "${data.taskTitle}"`);
  }, [toast]);

  // Socket reconnection key (changes when token changes to force reconnect)
  const [socketReconnectKey, setSocketReconnectKey] = useState(Date.now().toString());

  // Socket connection
  const socket = useSocket({
    onUsersInitialState: handleUsersInitialState,
    onUserOnline: handleUserOnline,
    onUserOffline: handleUserOffline,
    onUserStatusChanged: handleUserStatusChanged,
    onRoomUserJoined: handleRoomUserJoined,
    onRoomUserLeft: handleRoomUserLeft,
    onRoomKnocked: handleRoomKnocked,
    onCallIncoming: handleCallIncoming,
    onTaskMentioned: handleTaskMentioned,
  }, socketReconnectKey);

  // Check if impersonating
  const [isImpersonating, setIsImpersonating] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Check if impersonating
      const masterToken = localStorage.getItem('masterToken');
      if (masterToken) {
        setIsImpersonating(true);
      }

      try {
        const [meRes, usersRes, officeRes, sectorsRes, roomsRes, invitesRes] = await Promise.all([
          authApi.me(),
          usersApi.getAll(),
          officeApi.get(),
          sectorsApi.getAll(),
          roomsApi.getAll(),
          invitesApi.getAll().catch(() => ({ data: [] }))
        ]);

        const user = meRes.data;
        setCurrentUser(user);

        setOfficeData({
          id: officeRes.data.id,
          name: officeRes.data.name,
          logo: officeRes.data.logo,
          primaryColor: officeRes.data.primaryColor,
          workingHours: officeRes.data.workingHours,
          visitorInvites: invitesRes.data,
          users: usersRes.data,
          rooms: roomsRes.data,
          sectors: sectorsRes.data
        });

        // Only master users access admin panel
        if (user.role === 'master') {
          setCurrentView('admin');
        } else {
          setCurrentView('office');
        }
      } catch {
        sessionStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Setup Ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
    ringtoneRef.current.loop = true;
  }, []);

  // Handle Incoming Call Audio
  useEffect(() => {
    if (incomingCall) {
      ringtoneRef.current?.play().catch(e => console.log("Audio play failed", e));
    } else {
      ringtoneRef.current?.pause();
      if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    }
  }, [incomingCall]);

  // Working Hours Logic
  useEffect(() => {
    const checkWorkingHours = () => {
      if (currentView !== 'office' || !officeData.workingHours?.enabled || !currentUser) return;
      if (currentUser.role === 'admin' || currentUser.role === 'master') return;

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = officeData.workingHours.start.split(':').map(Number);
      const startTime = startH * 60 + startM;

      const [endH, endM] = officeData.workingHours.end.split(':').map(Number);
      const endTime = endH * 60 + endM;

      if (currentTime < startTime || currentTime >= endTime) {
        setCurrentView('closed');
        handleLeaveCall();
      }
    };

    const interval = setInterval(checkWorkingHours, 60000);
    checkWorkingHours();

    return () => clearInterval(interval);
  }, [currentView, officeData.workingHours, currentUser]);

  // Logout when browser/tab is closed
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (currentUser) {
        try {
          await authApi.logout();
        } catch {}
        localStorage.removeItem('token');
        localStorage.removeItem('masterToken');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  // Load office data helper
  const loadOfficeData = async () => {
    try {
      const [usersRes, officeRes, sectorsRes, roomsRes, invitesRes] = await Promise.all([
        usersApi.getAll(),
        officeApi.get(),
        sectorsApi.getAll(),
        roomsApi.getAll(),
        invitesApi.getAll().catch(() => ({ data: [] }))
      ]);

      setOfficeData({
        id: officeRes.data.id,
        name: officeRes.data.name,
        logo: officeRes.data.logo,
        primaryColor: officeRes.data.primaryColor,
        workingHours: officeRes.data.workingHours,
        visitorInvites: invitesRes.data,
        users: usersRes.data,
        rooms: roomsRes.data,
        sectors: sectorsRes.data
      });
    } catch (err) {
      console.error('Failed to load office data:', err);
    }
  };

  // Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    try {
      if (loginMode === 'visitor') {
        if (!visitorCode || !visitorName) return;

        const response = await authApi.visitorLogin(visitorName, visitorCode);
        localStorage.setItem('token', response.data.token);
        setCurrentUser(response.data.user);
        setSocketReconnectKey(Date.now().toString()); // Force socket reconnect
        await loadOfficeData();
        setCurrentView('office');
      } else {
        if (!emailInput || !passwordInput) return;

        const response = await authApi.login(emailInput, passwordInput);
        localStorage.setItem('token', response.data.token);
        setCurrentUser(response.data.user);
        setSocketReconnectKey(Date.now().toString()); // Force socket reconnect
        await loadOfficeData();

        // Only master users access admin panel
        if (response.data.user.role === 'master') {
          setCurrentView('admin');
        } else {
          setCurrentView('office');
        }
      }
    } catch (err: any) {
      const message = err.response?.data?.error || 'Erro ao fazer login';
      setLoginError(message);
    }
  };

  const handleEnterDemoFromAdmin = () => {
    setCurrentView('office');
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}

    localStorage.removeItem('token');
    localStorage.removeItem('masterToken');
    setCurrentUser(null);
    setCurrentView('login');
    setEmailInput('');
    setVisitorName('');
    setVisitorCode('');
    setIncomingCall(null);
    setActiveCall(null);
    setIsImpersonating(false);
    setOfficeData({
      id: 'default',
      name: 'Nexus Office',
      logo: '',
      workingHours: { enabled: false, start: '08:00', end: '18:00' },
      visitorInvites: [],
      users: [],
      rooms: [],
      sectors: []
    });
  };

  const handleStartCall = (target: User) => {
    socket.initiateCall(target.id, 'video');
    setActiveCall({
      roomName: `Chamada com ${target.name}`,
      participants: [target],
    });
  };

  const handleEnterRoom = async (room: Room) => {
    if (!currentUser) return;
    // Mostrar preview de mídia antes de entrar
    setPendingRoomJoin(room);
  };

  const handleConfirmRoomJoin = async () => {
    if (!currentUser || !pendingRoomJoin) return;

    const room = pendingRoomJoin;

    try {
      await roomsApi.join(room.id);
      socket.joinRoom(room.id);

      setOfficeData(prev => ({
        ...prev,
        users: prev.users.map(u =>
          u.id === currentUser.id
          ? { ...u, status: 'in-meeting' as UserStatus, currentRoomId: room.id }
          : u
        ),
        rooms: prev.rooms.map(r =>
          r.id === room.id
          ? { ...r, participants: [...r.participants, currentUser.id] }
          : r
        )
      }));

      setCurrentUser(prev => prev ? { ...prev, status: 'in-meeting', currentRoomId: room.id } : null);

      // Pega todos os participantes atuais da sala, incluindo os que já estavam lá
      const allParticipantsIds = [...new Set([...room.participants, currentUser.id])];
      const participants = officeData.users.filter(u => allParticipantsIds.includes(u.id) && u.id !== currentUser.id);

      console.log('[App] Entering room:', {
        roomId: room.id,
        roomName: room.name,
        participantsCount: participants.length,
        participantIds: participants.map(p => p.id)
      });

      setActiveCall({
        roomName: room.name,
        participants: participants,
        roomId: room.id
      });

      setPendingRoomJoin(null);
    } catch (err) {
      console.error('Failed to join room:', err);
      toast.error('Erro ao entrar na sala. Tente novamente.');
      setPendingRoomJoin(null);
    }
  };

  const handleLeaveCall = async () => {
    if (!currentUser) return;

    if (activeCall?.roomId) {
      try {
        await roomsApi.leave(activeCall.roomId);
        socket.leaveRoom(activeCall.roomId);
      } catch {}

      setOfficeData(prev => ({
        ...prev,
        users: prev.users.map(u =>
          u.id === currentUser.id
          ? { ...u, status: 'online' as UserStatus, currentRoomId: undefined }
          : u
        ),
        rooms: prev.rooms.map(r =>
          r.id === activeCall.roomId
          ? { ...r, participants: r.participants.filter(pid => pid !== currentUser.id) }
          : r
        )
      }));
      setCurrentUser(prev => prev ? { ...prev, status: 'online', currentRoomId: undefined } : null);
    }

    setActiveCall(null);
    setIsCallMinimized(false);
  };

  const handleCreateRoom = async (roomData: { name: string, color: string, image: string, isRestricted: boolean, icon: string }) => {
    try {
      const response = await roomsApi.create({
        name: roomData.name,
        type: 'fixed',
        isRestricted: roomData.isRestricted,
        capacity: 10,
        color: roomData.color,
        backgroundImage: roomData.image,
        icon: roomData.icon
      });

      setOfficeData(prev => ({
        ...prev,
        rooms: [...prev.rooms, response.data]
      }));
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      await roomsApi.delete(roomId);

      setOfficeData(prev => ({
        ...prev,
        rooms: prev.rooms.filter(r => r.id !== roomId),
        users: prev.users.map(u =>
          u.currentRoomId === roomId
          ? { ...u, status: 'online' as UserStatus, currentRoomId: undefined }
          : u
        )
      }));

      if (currentUser?.currentRoomId === roomId) {
        setCurrentUser(prev => prev ? { ...prev, status: 'online', currentRoomId: undefined } : null);
      }
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  const handleCreateSector = async (sectorData: { name: string; color: string }) => {
    try {
      await sectorsApi.create(sectorData);
      await loadOfficeData(); // Reload all data to update sectors
    } catch (err) {
      console.error('Failed to create sector:', err);
      throw err;
    }
  };

  const handleUpdateSector = async (sectorId: string, sectorData: { name: string; color: string }) => {
    try {
      await sectorsApi.update(sectorId, sectorData);
      await loadOfficeData(); // Reload all data to update sectors
    } catch (err) {
      console.error('Failed to update sector:', err);
      throw err;
    }
  };

  const handleDeleteSector = async (sectorId: string) => {
    try {
      await sectorsApi.delete(sectorId);
      await loadOfficeData(); // Reload all data to update sectors
    } catch (err) {
      console.error('Failed to delete sector:', err);
      throw err;
    }
  };

  const handleKnock = (target: User) => {
    if (target.currentRoomId) {
      socket.knockRoom(target.currentRoomId);
    }

    toast.info(`Toc toc em ${target.name}...`);

    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const handleCreateInvite = async (durationInMinutes: number): Promise<VisitorInvite> => {
    try {
      const response = await invitesApi.create(durationInMinutes);
      const newInvite = response.data;

      setOfficeData(prev => ({
        ...prev,
        visitorInvites: [...prev.visitorInvites, newInvite]
      }));

      return newInvite;
    } catch (err) {
      console.error('Failed to create invite:', err);
      throw err;
    }
  };

  const triggerFakeIncomingCall = () => {
    const potentialCallers = officeData.users.filter(u => u.id !== currentUser?.id && u.status !== 'offline');
    const randomCaller = potentialCallers[Math.floor(Math.random() * potentialCallers.length)];
    if (randomCaller) {
      setIncomingCall({ caller: randomCaller });
    }
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    socket.acceptCall(incomingCall.caller.id);
    setIncomingCall(null);
    setActiveCall({
      roomName: `Chamada com ${incomingCall.caller.name}`,
      participants: [incomingCall.caller],
      roomId: incomingCall.roomId
    });
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    socket.rejectCall(incomingCall.caller.id);
    setIncomingCall(null);
  };

  const handleInviteUsers = (usersToInvite: User[]) => {
    const names = usersToInvite.map(u => u.name).join(', ');
    toast.info(`Convidando: ${names}...`);

    usersToInvite.forEach(user => {
      socket.initiateCall(user.id, 'video');
    });
  };

  const handleUpdateStatus = async (status: UserStatus, message?: string) => {
    if (!currentUser) return;

    try {
      await usersApi.updateStatus(currentUser.id, status, message);
      socket.changeStatus(status, message);

      const updatedUser = { ...currentUser, status, statusMessage: message };
      setCurrentUser(updatedUser);
      setOfficeData(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === currentUser.id ? updatedUser : u)
      }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleUpdateOffice = async (data: Partial<Office>) => {
    try {
      const updateData: any = { ...data };
      if (data.workingHours) {
        updateData.workingHoursEnabled = data.workingHours.enabled;
        updateData.workingHoursStart = data.workingHours.start;
        updateData.workingHoursEnd = data.workingHours.end;
        delete updateData.workingHours;
      }

      await officeApi.update(updateData);
      setOfficeData(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error('Failed to update office:', err);
    }
  };

  const handleUpdateUser = async (userData: User) => {
    try {
      await usersApi.update(userData.id, {
        name: userData.name,
        avatar: userData.avatar,
        role: userData.role,
        jobTitle: userData.jobTitle,
        sectorId: userData.sector || null
      });

      setOfficeData(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === userData.id ? userData : u)
      }));

      if (currentUser?.id === userData.id) {
        setCurrentUser(userData);
      }
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const handleCreateUser = async (newUser: User) => {
    // Users are created via login - this just adds to local state
    setOfficeData(prev => ({
      ...prev,
      users: [...prev.users, newUser]
    }));
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await usersApi.delete(userId);
      setOfficeData(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== userId)
      }));
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      // Save current master token
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        localStorage.setItem('masterToken', currentToken);
      }

      // Impersonate user
      const response = await authApi.impersonate(userId);
      localStorage.setItem('token', response.data.token);
      setCurrentUser(response.data.user);
      setIsImpersonating(true);
      setSocketReconnectKey(Date.now().toString()); // Force socket reconnect

      // Load office data for impersonated user
      await loadOfficeData();

      // Navigate to office view
      setCurrentView('office');
    } catch (err: any) {
      console.error('Failed to impersonate user:', err);
      alert(err.response?.data?.error || 'Erro ao entrar como usuário');
    }
  };

  const handleUnimpersonate = async () => {
    try {
      // Restore master token
      const masterToken = localStorage.getItem('masterToken');
      if (masterToken) {
        localStorage.setItem('token', masterToken);
        localStorage.removeItem('masterToken');

        // Reload master user data
        const response = await authApi.me();
        setCurrentUser(response.data);
        setIsImpersonating(false);
        setSocketReconnectKey(Date.now().toString()); // Force socket reconnect

        // Load office data
        await loadOfficeData();

        // Navigate back to admin view
        setCurrentView('admin');
      }
    } catch (err) {
      console.error('Failed to unimpersonate:', err);
    }
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Render Login
  if (currentView === 'login') {
    const isMasterInput = emailInput === MASTER_EMAIL;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_200px,#3b0764,transparent)]"></div>

        <div className="w-full max-w-sm p-6 relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-white/5 border border-white/10 rounded-2xl mb-6 shadow-2xl shadow-purple-500/20 backdrop-blur-sm">
              <LayoutGrid className="text-purple-400" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight mb-2">reune.io</h1>
            <p className="text-slate-400">Seu escritório digital, em qualquer lugar.</p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl">
            <div className="bg-slate-950/50 rounded-xl p-6 border border-white/5">

              <form onSubmit={handleLogin} className="space-y-5">

              {loginMode === 'employee' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                      <Briefcase size={12}/> Login Corporativo
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="nome@empresa.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                      <Lock size={12}/> Senha
                    </label>
                    <input
                      type="password"
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="Sua senha"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                        <Ticket size={12}/> Acesso Visitante
                      </label>
                    </div>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                      placeholder="Seu Nome"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                      <input
                        type="text"
                        required
                        className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all uppercase font-mono tracking-widest"
                        placeholder="CÓDIGO"
                        value={visitorCode}
                        onChange={(e) => setVisitorCode(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>
                </>
              )}

              {loginError && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs font-medium">
                  {loginError}
                </div>
              )}

              {loginMode === 'employee' && (
                <div className={`transition-all duration-300 overflow-hidden ${isMasterInput ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-300 text-xs font-medium flex items-center gap-2">
                    <ShieldCheck size={14} className="text-purple-400" />
                    Acesso Master Identificado
                  </div>
                </div>
              )}

              <button
                type="submit"
                className={`w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 group mt-2 ${loginMode === 'employee' ? 'bg-white text-slate-950 hover:bg-slate-200' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
              >
                {loginMode === 'employee' ? (isMasterInput ? 'Acessar Painel' : 'Acessar Escritório') : 'Validar Convite'}
                <ArrowRight size={18} className={`${loginMode === 'employee' ? 'text-purple-600' : 'text-white'} group-hover:translate-x-1 transition-transform`} />
              </button>
              </form>
            </div>
          </div>

          <div className="mt-8 text-center space-y-4">
            {loginMode === 'employee' ? (
              <button onClick={() => setLoginMode('visitor')} className="text-slate-500 text-sm hover:text-amber-400 transition-colors font-medium flex items-center justify-center gap-2 mx-auto">
                <Ticket size={16}/> Possui um convite? Acessar como Visitante
              </button>
            ) : (
              <button onClick={() => setLoginMode('employee')} className="text-slate-500 text-sm hover:text-purple-400 transition-colors font-medium flex items-center justify-center gap-2 mx-auto">
                <Briefcase size={16}/> Voltar para Login Corporativo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Office Closed Screen
  if (currentView === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="text-center relative z-10 p-8 max-w-md">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
            <Clock size={40} className="text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Escritório Fechado</h1>
          <p className="text-slate-400 mb-8">
            O escritório está fechado no momento. <br/>
            Horário de funcionamento: <span className="text-white font-mono">{officeData.workingHours?.start} - {officeData.workingHours?.end}</span>
          </p>
          <button onClick={handleLogout} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors border border-slate-700">
            Sair da Aplicação
          </button>
        </div>
      </div>
    );
  }

  // Render Admin
  if (currentView === 'admin') {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <AdminDashboard
          onLogout={handleLogout}
          onEnterDemo={handleEnterDemoFromAdmin}
          onImpersonate={handleImpersonate}
        />
      </Suspense>
    );
  }

  // Render Office
  return (
    <MediaProvider>
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <UserCircle size={20} />
            <span className="font-semibold text-sm">
              Você está logado como: <span className="font-bold">{currentUser?.name}</span>
            </span>
          </div>
          <button
            onClick={handleUnimpersonate}
            className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold text-sm hover:bg-purple-50 transition-colors flex items-center gap-2"
          >
            <ArrowRight size={16} className="rotate-180" />
            Voltar para conta Master
          </button>
        </div>
      )}

      {/* Dev Tool: Fake Call Trigger */}
      <div className="fixed top-24 right-8 z-40 group">
        <button
          onClick={triggerFakeIncomingCall}
          className="p-3 bg-white border border-slate-200 shadow-md rounded-full text-indigo-600 hover:bg-indigo-50 transition-all opacity-50 hover:opacity-100"
          title="Simular Chamada Recebida (Demo)"
        >
          <PhoneIncoming size={20} />
        </button>
      </div>

      <Suspense fallback={<ComponentLoader />}>
        <OfficeView
          office={officeData}
          currentUser={currentUser!}
          onLogout={handleLogout}
          onStartCall={handleStartCall}
          onEnterRoom={handleEnterRoom}
          onUpdateStatus={handleUpdateStatus}
          onKnock={handleKnock}
          onCreateRoom={handleCreateRoom}
          onDeleteRoom={handleDeleteRoom}
          onUpdateOffice={handleUpdateOffice}
          onUpdateUser={handleUpdateUser}
          onCreateUser={handleCreateUser}
          onDeleteUser={handleDeleteUser}
          onCreateInvite={handleCreateInvite}
          onCreateSector={handleCreateSector}
          onUpdateSector={handleUpdateSector}
          onDeleteSector={handleDeleteSector}
        />
      </Suspense>

      {/* Media Preview Modal */}
      {pendingRoomJoin && (
        <Suspense fallback={<ComponentLoader />}>
          <MediaPreviewModal
            roomName={pendingRoomJoin.name}
            onJoin={handleConfirmRoomJoin}
            onCancel={() => setPendingRoomJoin(null)}
          />
        </Suspense>
      )}

      {activeCall && !isCallMinimized && (
        <Suspense fallback={<ComponentLoader />}>
          <VideoModal
            currentUser={currentUser!}
            participants={activeCall.participants}
            roomName={activeCall.roomName}
            allUsers={officeData.users}
            onLeave={handleLeaveCall}
            onInvite={handleInviteUsers}
            onMinimize={() => setIsCallMinimized(true)}
          />
        </Suspense>
      )}

      {activeCall && isCallMinimized && (
        <Suspense fallback={null}>
          <MinimizedCall
            title={activeCall.roomName}
            type={activeCall.roomId ? 'room' : 'call'}
            participantCount={activeCall.participants.length}
            onExpand={() => setIsCallMinimized(false)}
            onEnd={handleLeaveCall}
          />
        </Suspense>
      )}

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-indigo-500/10 animate-pulse"></div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="relative mb-6">
                <img src={incomingCall.caller.avatar} className="w-24 h-24 rounded-full border-4 border-slate-800 shadow-xl" />
                <div className="absolute bottom-0 right-0 p-2 bg-green-500 rounded-full border-4 border-slate-800 animate-bounce">
                  <Phone size={16} className="text-white" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-white mb-1">{incomingCall.caller.name}</h3>
              <p className="text-indigo-300 text-sm font-medium mb-8 animate-pulse">Chamando você...</p>

              <div className="flex gap-6 w-full justify-center">
                <button
                  onClick={handleRejectCall}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all shadow-lg">
                    <X size={24} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Recusar</span>
                </button>

                <button
                  onClick={handleAcceptCall}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white group-hover:bg-green-400 transition-all shadow-lg shadow-green-500/30 animate-pulse">
                    <Phone size={24} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Aceitar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </MediaProvider>
  );
}
