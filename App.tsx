
import React, { useState, useEffect, useRef } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { OfficeView } from './components/OfficeView';
import { VideoModal } from './components/VideoModal';
import { DEMO_OFFICE, MOCK_USERS } from './constants';
import { User, UserStatus, Room, Office, VisitorInvite } from './types';
import { ArrowRight, Layers, LayoutGrid, ShieldCheck, Phone, PhoneIncoming, X, Check, Clock, Lock, Ticket, Briefcase } from 'lucide-react';

const MASTER_EMAIL = 'yago.tgavilan@gmail.com';

export default function App() {
  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'login' | 'admin' | 'office' | 'closed'>('login');
  
  // Lift office state to manage dynamic updates (rooms, user statuses, settings)
  const [officeData, setOfficeData] = useState<Office>({
      ...DEMO_OFFICE,
      workingHours: { enabled: false, start: '08:00', end: '18:00' }, // Default config
      visitorInvites: []
  });
  
  const [activeCall, setActiveCall] = useState<{ roomName: string, participants: User[], roomId?: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ caller: User, roomId?: string } | null>(null);
  
  const [notifications, setNotifications] = useState<{ id: string, message: string, type?: 'info' | 'error' }[]>([]);

  // Audio refs
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Login Form State
  const [emailInput, setEmailInput] = useState('');
  const [loginMode, setLoginMode] = useState<'employee' | 'visitor'>('employee');
  const [visitorName, setVisitorName] = useState('');
  const [visitorCode, setVisitorCode] = useState('');

  // Setup Ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3'); // Phone Ringtone
    ringtoneRef.current.loop = true;
  }, []);

  // Handle Incoming Call Audio
  useEffect(() => {
    if (incomingCall) {
        ringtoneRef.current?.play().catch(e => console.log("Audio play failed interaction required", e));
    } else {
        ringtoneRef.current?.pause();
        if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    }
  }, [incomingCall]);

  // Working Hours Logic Enforcement
  useEffect(() => {
      const checkWorkingHours = () => {
          if (currentView !== 'office' || !officeData.workingHours?.enabled || !currentUser) return;
          if (currentUser.role === 'admin' || currentUser.role === 'master') return; // Admins bypass

          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes from midnight
          
          const [startH, startM] = officeData.workingHours.start.split(':').map(Number);
          const startTime = startH * 60 + startM;

          const [endH, endM] = officeData.workingHours.end.split(':').map(Number);
          const endTime = endH * 60 + endM;

          if (currentTime < startTime || currentTime >= endTime) {
              setCurrentView('closed');
              handleLeaveCall(); // Disconnect calls
          }
      };

      const interval = setInterval(checkWorkingHours, 60000); // Check every minute
      checkWorkingHours(); // Initial check

      return () => clearInterval(interval);
  }, [currentView, officeData.workingHours, currentUser]);

  // Visitor Expiration Check
  useEffect(() => {
      const checkVisitorExpiration = () => {
          if (currentUser && currentUser.role === 'visitor' && currentUser.visitorInviteId) {
              const invite = officeData.visitorInvites.find(i => i.id === currentUser.visitorInviteId);
              if (invite && new Date() > new Date(invite.expiresAt)) {
                  alert("Seu tempo de visita expirou. Obrigado pela visita!");
                  handleLogout();
              }
          }
      };

      const interval = setInterval(checkVisitorExpiration, 10000); // Check every 10 sec
      return () => clearInterval(interval);
  }, [currentUser, officeData.visitorInvites]);


  // Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (loginMode === 'visitor') {
        if (!visitorCode || !visitorName) return;
        
        const invite = officeData.visitorInvites.find(i => i.code === visitorCode);
        
        if (!invite) {
            alert("Código de convite inválido.");
            return;
        }

        if (new Date() > new Date(invite.expiresAt)) {
            alert("Este convite expirou.");
            return;
        }

        if (invite.usedBy) {
            alert("Este convite já está em uso.");
            // Optional: allow rejoin if same session/cookie, but simplified here
            return;
        }

        // Create Visitor User
        const visitorUser: User = {
            id: `visitor-${Date.now()}`,
            name: `${visitorName} (Visitante)`,
            email: `visitor-${Date.now()}@temp.io`,
            avatar: `https://ui-avatars.com/api/?name=${visitorName}&background=fcd34d&color=fff`,
            role: 'visitor',
            sector: 'visitor', // Special sector or 'all'
            status: 'online',
            visitorInviteId: invite.id
        };

        // Update Office Data: Add user and mark invite as used
        setOfficeData(prev => ({
            ...prev,
            users: [...prev.users, visitorUser],
            visitorInvites: prev.visitorInvites.map(i => i.id === invite.id ? { ...i, usedBy: visitorUser.id } : i)
        }));

        setCurrentUser(visitorUser);
        setCurrentView('office');

    } else {
        // Regular Login
        if (!emailInput) return;

        if (emailInput === MASTER_EMAIL) {
            const masterUser = MOCK_USERS.find(u => u.email === MASTER_EMAIL) || MOCK_USERS[0];
            setCurrentUser(masterUser);
            setCurrentView('admin');
        } else {
            const existingUser = officeData.users.find(u => u.email === emailInput);
            if (!existingUser) {
                // Auto-create for demo
                const userToUse = {
                    ...MOCK_USERS[1],
                    id: `temp-${Date.now()}`,
                    email: emailInput,
                    name: emailInput.split('@')[0],
                    role: 'user' as const,
                    sector: officeData.sectors[0].id
                };
                setOfficeData(prev => ({ ...prev, users: [...prev.users, userToUse] }));
                setCurrentUser(userToUse);
                setCurrentView('office');
            } else {
                setCurrentUser(existingUser);
                setCurrentView('office');
            }
        }
    }
  };

  const handleEnterDemoFromAdmin = () => {
    setCurrentView('office');
  };

  const handleLogout = () => {
    // If visitor, remove them from user list when they leave? 
    // Usually yes for temporary access, or keep as offline. 
    // Let's remove them to simulate "leaving the building" completely.
    if (currentUser?.role === 'visitor') {
        setOfficeData(prev => ({
            ...prev,
            users: prev.users.filter(u => u.id !== currentUser.id),
            // Optionally free up the invite? Depends on business logic. 
            // "Esse convite não sera valido nunca mais" -> Keep it marked as used/expired.
            visitorInvites: prev.visitorInvites.map(i => i.id === currentUser.visitorInviteId ? { ...i, usedBy: undefined, expiresAt: new Date() } : i) // Expire it immediately on logout
        }));
    } else {
        // Regular logout
        if (currentUser) {
             setOfficeData(prev => ({
                ...prev,
                users: prev.users.map(u => u.id === currentUser.id ? { ...u, status: 'offline' as UserStatus } : u)
             }));
        }
    }

    setCurrentUser(null);
    setCurrentView('login');
    setEmailInput('');
    setVisitorName('');
    setVisitorCode('');
    setIncomingCall(null);
    setActiveCall(null);
  };

  const handleStartCall = (target: User) => {
    setActiveCall({
      roomName: `Chamada com ${target.name}`,
      participants: [target],
    });
  };

  const handleEnterRoom = (room: Room) => {
    if (!currentUser) return;

    setOfficeData(prev => ({
        ...prev,
        users: prev.users.map(u => 
            u.id === currentUser.id 
            ? { ...u, status: 'in-meeting', currentRoomId: room.id } 
            : u
        ),
        rooms: prev.rooms.map(r => 
            r.id === room.id 
            ? { ...r, participants: [...r.participants, currentUser.id] }
            : r
        )
    }));

    setCurrentUser(prev => prev ? { ...prev, status: 'in-meeting', currentRoomId: room.id } : null);

    const participantsIds = [...room.participants]; 
    const participants = officeData.users.filter(u => participantsIds.includes(u.id) && u.id !== currentUser.id);

    setActiveCall({
      roomName: room.name,
      participants: participants,
      roomId: room.id
    });
  };

  const handleLeaveCall = () => {
    if (!currentUser) return;
    
    if (activeCall?.roomId) {
        setOfficeData(prev => ({
            ...prev,
            users: prev.users.map(u => 
                u.id === currentUser.id 
                ? { ...u, status: 'online', currentRoomId: undefined } 
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
  };

  const handleCreateRoom = (roomData: { name: string, color: string, image: string, type: 'fixed' | 'private', icon: string }) => {
    const newRoom: Room = {
        id: `room-${Date.now()}`,
        name: roomData.name,
        type: roomData.type,
        participants: [],
        isRestricted: roomData.type === 'private',
        capacity: 10,
        color: roomData.color,
        backgroundImage: roomData.image,
        icon: roomData.icon
    };

    setOfficeData(prev => ({
        ...prev,
        rooms: [...prev.rooms, newRoom]
    }));
  };

  const handleDeleteRoom = (roomId: string) => {
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
  };

  const handleKnock = (target: User) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message: `Toc toc em ${target.name}... ✊`, type: 'info' }]);
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
    
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'); 
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  // --- Invite & Call Logic ---

  const handleCreateInvite = (durationInMinutes: number): VisitorInvite => {
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + durationInMinutes);
      
      const newInvite: VisitorInvite = {
          id: `inv-${Date.now()}`,
          code: Math.random().toString(36).substring(2, 8).toUpperCase(), // e.g., "7F2A9C"
          expiresAt: expirationDate,
          creatorId: currentUser?.id || 'system',
          durationInMinutes
      };

      setOfficeData(prev => ({
          ...prev,
          visitorInvites: [...prev.visitorInvites, newInvite]
      }));

      return newInvite;
  };

  const triggerFakeIncomingCall = () => {
    const potentialCallers = officeData.users.filter(u => u.id !== currentUser?.id);
    const randomCaller = potentialCallers[Math.floor(Math.random() * potentialCallers.length)];
    if (randomCaller) {
        setIncomingCall({ caller: randomCaller });
    }
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    setIncomingCall(null);
    setActiveCall({
        roomName: `Chamada com ${incomingCall.caller.name}`,
        participants: [incomingCall.caller],
        roomId: incomingCall.roomId
    });
  };

  const handleRejectCall = () => {
     if (!incomingCall) return;
     setIncomingCall(null);
  };

  const handleInviteUsers = (usersToInvite: User[]) => {
      const names = usersToInvite.map(u => u.name).join(', ');
      const id = Date.now().toString();
      setNotifications(prev => [...prev, { id, message: `Convidando: ${names}...`, type: 'info' }]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);

      setTimeout(() => {
          const outcome = Math.random() > 0.3 ? 'accept' : 'reject';
          const targetUser = usersToInvite[0];

          if (outcome === 'reject') {
              const notifId = Date.now().toString();
              setNotifications(prev => [...prev, { 
                  id: notifId, 
                  message: `${targetUser.name} recusou a chamada.`,
                  type: 'error'
              }]);
              setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notifId)), 5000);
          } else {
              if (activeCall) {
                  setActiveCall(prev => prev ? {
                      ...prev,
                      participants: [...prev.participants, targetUser]
                  } : null);
                  
                  const notifId = Date.now().toString();
                  setNotifications(prev => [...prev, { 
                      id: notifId, 
                      message: `${targetUser.name} entrou na sala.`,
                      type: 'info'
                  }]);
                  setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notifId)), 3000);
              }
          }
      }, 2500);
  };

  const handleUpdateStatus = (status: UserStatus, message?: string) => {
    if (currentUser) {
        const updatedUser = { ...currentUser, status, statusMessage: message };
        setCurrentUser(updatedUser);
        setOfficeData(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === currentUser.id ? updatedUser : u)
        }));
    }
  };

  // --- Admin/Settings Handlers ---
  const handleUpdateOffice = (data: Partial<Office>) => {
      setOfficeData(prev => ({ ...prev, ...data }));
  };

  const handleUpdateUser = (userData: User) => {
      setOfficeData(prev => ({
          ...prev,
          users: prev.users.map(u => u.id === userData.id ? userData : u)
      }));
      // Update local current user if it's the same person
      if (currentUser?.id === userData.id) {
          setCurrentUser(userData);
      }
  };

  const handleCreateUser = (newUser: User) => {
      setOfficeData(prev => ({
          ...prev,
          users: [...prev.users, newUser]
      }));
  };

  const handleDeleteUser = (userId: string) => {
      setOfficeData(prev => ({
          ...prev,
          users: prev.users.filter(u => u.id !== userId)
      }));
  };

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
      )
  }

  // Render Admin
  if (currentView === 'admin') {
    return (
      <AdminDashboard 
        onLogout={handleLogout} 
        onEnterDemo={handleEnterDemoFromAdmin}
      />
    );
  }

  // Render Office
  return (
    <>
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
      />
      
      {activeCall && (
        <VideoModal 
          currentUser={currentUser!}
          participants={activeCall.participants}
          roomName={activeCall.roomName}
          allUsers={officeData.users}
          onLeave={handleLeaveCall}
          onInvite={handleInviteUsers}
        />
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

      {/* Notifications Toast */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3">
          {notifications.map(n => (
              <div key={n.id} className={`bg-white/90 backdrop-blur-md border shadow-2xl p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-right-10 fade-in duration-300 max-w-sm ${n.type === 'error' ? 'border-red-200' : 'border-indigo-100'}`}>
                  <span className={`text-xl p-2 rounded-xl ${n.type === 'error' ? 'bg-red-100' : 'bg-indigo-100'}`}>
                      {n.type === 'error' ? '🚫' : '👋'}
                  </span>
                  <div>
                      <p className="text-slate-800 font-bold text-sm">{n.type === 'error' ? 'Ops!' : 'Notificação'}</p>
                      <p className="text-slate-600 text-sm">{n.message}</p>
                  </div>
              </div>
          ))}
      </div>
    </>
  );
}
