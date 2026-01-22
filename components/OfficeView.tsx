
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Bell, Settings, LogOut, Video, Monitor, Hand, 
  MessageSquare, User as UserIcon, Lock, Users, Briefcase, ChevronDown, 
  LogIn, Plus, X, Image as ImageIcon, Trash2, Hash, Coffee, Presentation, 
  Armchair, LayoutTemplate, Gamepad2, Maximize2, Minimize2, PanelRight, 
  MoreVertical, Paperclip, Smile, Send, ChevronLeft, Phone,
  Edit2, Check, CheckCheck, UserPlus, AtSign, MessageCircle, Megaphone,
  Calendar as CalendarIcon, Clock, Music, Play, Pause, FileAudio, Upload, Square,
  ClipboardList, List, Kanban, TableProperties, AlertCircle, FileText, Download,
  History, ArrowRight, Tag, Palette, Shield, UserPlus as UserAdd, QrCode,
  Layers, UserCog, Copy, RefreshCw
} from 'lucide-react';
import { User, Office, Room, UserStatus, ChatChannel, ChatMessage, Announcement, Task, TaskStatus, TaskPriority, TaskAttachment, TaskComment, TaskHistory, Sector, VisitorInvite } from '../types';

interface OfficeViewProps {
  office: Office;
  currentUser: User;
  onLogout: () => void;
  onStartCall: (target: User) => void;
  onEnterRoom: (room: Room) => void;
  onUpdateStatus: (status: UserStatus, message?: string) => void;
  onKnock: (target: User) => void;
  onCreateRoom: (roomData: { name: string, color: string, image: string, type: 'fixed' | 'private', icon: string }) => void;
  onDeleteRoom: (roomId: string) => void;
  // New props for Settings
  onUpdateOffice: (data: Partial<Office>) => void;
  onUpdateUser: (user: User) => void;
  onCreateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onCreateInvite: (durationInMinutes: number) => VisitorInvite;
}

const STATUS_CONFIG = {
  'online': { color: 'bg-emerald-500', label: 'Online', ring: 'ring-emerald-200' },
  'busy': { color: 'bg-rose-500', label: 'Busy', ring: 'ring-rose-200' },
  'away': { color: 'bg-amber-500', label: 'Away', ring: 'ring-amber-200' },
  'offline': { color: 'bg-slate-400', label: 'Offline', ring: 'ring-slate-200' },
  'in-meeting': { color: 'bg-violet-500', label: 'In Meeting', ring: 'ring-violet-200' },
};

// Map of available icons for rooms
const ROOM_ICONS: Record<string, React.ElementType> = {
    'default': LayoutTemplate,
    'presentation': Presentation,
    'users': Users,
    'coffee': Coffee,
    'hash': Hash,
    'armchair': Armchair,
    'monitor': Monitor,
    'game': Gamepad2
};

const SOUND_OPTIONS = [
    { id: 'bell', label: 'Sino (Suave)', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
    { id: 'doorbell', label: 'Campainha', url: 'https://assets.mixkit.co/active_storage/sfx/194/194-preview.mp3' },
    { id: 'siren', label: 'Sirene (Alerta)', url: 'https://assets.mixkit.co/active_storage/sfx/255/255-preview.mp3' },
    { id: 'ping', label: 'Ping Digital', url: 'https://assets.mixkit.co/active_storage/sfx/1003/1003-preview.mp3' },
];

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string, color: string, bg: string, border: string }> = {
    'todo': { label: 'A Fazer', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-300' },
    'in_progress': { label: 'Em Progresso', color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-300' },
    'review': { label: 'Revisão', color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-300' },
    'done': { label: 'Concluído', color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-300' }
};

const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, iconColor: string }> = {
    'low': { label: 'Baixa', color: 'bg-slate-200 text-slate-700', iconColor: 'text-slate-500' },
    'medium': { label: 'Média', color: 'bg-amber-200 text-amber-800', iconColor: 'text-amber-600' },
    'high': { label: 'Alta', color: 'bg-rose-200 text-rose-800', iconColor: 'text-rose-600' }
};

type SidebarMode = 'hidden' | 'chat' | 'notifications' | 'tasks';

export const OfficeView: React.FC<OfficeViewProps> = ({ 
  office, currentUser, onLogout, onStartCall, onEnterRoom, onUpdateStatus, onKnock, onCreateRoom, onDeleteRoom,
  onUpdateOffice, onUpdateUser, onCreateUser, onDeleteUser, onCreateInvite
}) => {
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);

  // --- Sidebar & Drawer State ---
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('hidden');
  const [chatFullScreen, setChatFullScreen] = useState(false);
  const [taskFullScreen, setTaskFullScreen] = useState(false);

  // --- Chat State ---
  const [channels, setChannels] = useState<ChatChannel[]>([]); 
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [chatMessageInput, setChatMessageInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Notification / Announcement State ---
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);
  const [showComposeAnnouncement, setShowComposeAnnouncement] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<{id: string, text: string, type: 'task' | 'system', referenceId?: string}[]>([]);

  // --- Task Management State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Modals
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [showAddPeopleModal, setShowAddPeopleModal] = useState(false); 
  
  // Settings & Profile
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // --- Notification State ---
  const [hasNotifications, setHasNotifications] = useState(false);

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'master';

  useEffect(() => {
    if (channels.length === 0 && office.users.length > 0) {
        const generalChannel: ChatChannel = {
            id: 'general',
            type: 'group',
            name: 'Geral',
            participants: office.users.map(u => u.id),
            messages: [
                { id: 'm1', senderId: office.users[1]?.id || 'u2', text: 'Bom dia pessoal!', timestamp: new Date(Date.now() - 3600000), readBy: [], mentions: [] }
            ],
            unreadCount: 0,
            lastMessageAt: new Date(Date.now() - 3600000)
        };
        setChannels([generalChannel]);
    }
    if (tasks.length === 0) {
        setTasks([
            {
                id: 't1',
                title: 'Atualizar documentação da API',
                description: 'Revisar endpoints de autenticação e atualizar swagger.',
                status: 'in_progress',
                priority: 'high',
                assigneeId: currentUser.id,
                creatorId: 'u2',
                tags: ['dev', 'docs'],
                attachments: [],
                comments: [],
                history: [{ id: 'h1', userId: 'u2', action: 'Criou a tarefa', timestamp: new Date(Date.now() - 86400000) }],
                createdAt: new Date(Date.now() - 86400000),
                dueDate: new Date(Date.now() + 86400000 * 2)
            }
        ]);
    }
    if (announcements.length === 0) {
        setAnnouncements([{
            id: 'a1',
            senderId: 'u1',
            title: 'Bem-vindo ao reune.io!',
            message: 'Estamos muito felizes em ter você aqui. Explore as salas e interaja com seus colegas.',
            createdAt: new Date(Date.now() - 86400000),
            recipients: 'all',
            readBy: [currentUser.id]
        }]);
    }
  }, [office.users]);

  const sortedChannels = useMemo(() => {
      return [...channels].sort((a, b) => {
          const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return dateB - dateA;
      });
  }, [channels]);

  const filteredUsers = useMemo(() => {
    return office.users.filter(u => {
      if (u.id === currentUser.id) return false;
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSector = selectedSector === 'all' || u.sector === selectedSector;
      return matchesSearch && matchesSector;
    });
  }, [office.users, searchQuery, selectedSector, currentUser.id]);

  const usersBySector = useMemo(() => {
    const grouped: Record<string, User[]> = {};
    office.sectors.forEach(s => grouped[s.id] = []);
    filteredUsers.forEach(u => {
      if (grouped[u.sector]) grouped[u.sector].push(u);
    });
    return grouped;
  }, [filteredUsers, office.sectors]);

  const handleToggleChat = () => setSidebarMode(prev => prev === 'chat' ? 'hidden' : 'chat');
  const handleToggleTasks = () => setSidebarMode(prev => prev === 'tasks' ? 'hidden' : 'tasks');
  const handleToggleNotifications = () => {
      setSidebarMode(prev => prev === 'notifications' ? 'hidden' : 'notifications');
      setHasNotifications(false);
  };

  const handleOpenChatWithUser = (user: User) => {
      if (sidebarMode !== 'chat') setSidebarMode('chat');
      const existingChannel = channels.find(c => c.type === 'dm' && c.participants.includes(user.id) && c.participants.includes(currentUser.id));
      if (existingChannel) {
          setActiveChannelId(existingChannel.id);
      } else {
          const newChannel: ChatChannel = { id: `dm-${Date.now()}`, type: 'dm', participants: [currentUser.id, user.id], messages: [], unreadCount: 0, lastMessageAt: new Date() };
          setChannels(prev => [...prev, newChannel]);
          setActiveChannelId(newChannel.id);
      }
      setShowNewDMModal(false);
  };

  const handleAddPeopleToChat = (newMemberIds: string[]) => {
      if (!activeChannel) return;
      const existingParticipants = activeChannel.participants;
      const allParticipants = Array.from(new Set([...existingParticipants, ...newMemberIds]));
      const names = office.users.filter(u => allParticipants.includes(u.id)).map(u => u.name.split(' ')[0]).join(', ');
      const newChannel: ChatChannel = { id: `group-${Date.now()}`, type: 'group', name: names.substring(0, 30) + (names.length > 30 ? '...' : ''), participants: allParticipants, messages: [], unreadCount: 0, lastMessageAt: new Date() };
      setChannels(prev => [newChannel, ...prev]);
      setActiveChannelId(newChannel.id);
      setShowAddPeopleModal(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatMessageInput.trim() || !activeChannelId) return;

      if (editingMessageId) {
          setChannels(prev => prev.map(c => {
              if (c.id === activeChannelId) return { ...c, messages: c.messages.map(m => m.id === editingMessageId ? { ...m, text: chatMessageInput, editedAt: new Date(), mentions: [] } : m) };
              return c;
          }));
          setEditingMessageId(null);
      } else {
          const newMsg: ChatMessage = { id: Date.now().toString(), text: chatMessageInput, senderId: currentUser.id, timestamp: new Date(), readBy: [currentUser.id], mentions: [] };
          setChannels(prev => prev.map(c => {
              if (c.id === activeChannelId) return { ...c, messages: [...c.messages, newMsg], lastMessageAt: new Date(), unreadCount: 0 };
              return c;
          }));
      }
      setChatMessageInput('');
      setMentionQuery(null);
  };

  const handleDeleteMessage = (msgId: string) => {
      if (!activeChannelId) return;
      setChannels(prev => prev.map(c => { if (c.id === activeChannelId) return { ...c, messages: c.messages.filter(m => m.id !== msgId) }; return c; }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setChatMessageInput(val);
      const lastWord = val.split(' ').pop();
      if (lastWord && lastWord.startsWith('@')) setMentionQuery(lastWord.substring(1));
      else setMentionQuery(null);
  };

  const insertMention = (user: User) => {
      const words = chatMessageInput.split(' ');
      words.pop();
      const newText = [...words, `@${user.name} `].join(' ');
      setChatMessageInput(newText);
      setMentionQuery(null);
  };

  const handleCreateGroup = (name: string, selectedUsers: string[]) => {
      const newChannel: ChatChannel = { id: `group-${Date.now()}`, type: 'group', name: name, participants: [currentUser.id, ...selectedUsers], messages: [], unreadCount: 0, lastMessageAt: new Date() };
      setChannels(prev => [...prev, newChannel]);
      setActiveChannelId(newChannel.id);
      setShowCreateGroupModal(false);
  };

  const handleSendAnnouncement = (data: Partial<Announcement>) => {
      const newAnnouncement: Announcement = {
          id: `ann-${Date.now()}`,
          senderId: currentUser.id,
          title: data.title || 'Comunicado',
          message: data.message || '',
          imageUrl: data.imageUrl,
          soundUrl: data.soundUrl,
          createdAt: new Date(),
          scheduledFor: data.scheduledFor,
          recipients: data.recipients || 'all',
          readBy: []
      };
      setAnnouncements(prev => [newAnnouncement, ...prev]);
      setShowComposeAnnouncement(false);
      if (!data.scheduledFor || data.scheduledFor.getTime() <= Date.now()) setActiveAnnouncement(newAnnouncement);
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
      if (editingTask) {
          const updatedTask: Task = {
              ...editingTask,
              ...taskData,
              history: [
                  ...editingTask.history,
                  ...(editingTask.assigneeId !== taskData.assigneeId ? [{ id: `h-${Date.now()}`, userId: currentUser.id, action: `Transferiu para ${office.users.find(u => u.id === taskData.assigneeId)?.name}`, timestamp: new Date() }] : []),
                  ...(editingTask.status !== taskData.status ? [{ id: `h-${Date.now()}`, userId: currentUser.id, action: `Alterou status para ${TASK_STATUS_CONFIG[taskData.status as TaskStatus].label}`, timestamp: new Date() }] : [])
              ]
          } as Task;
          setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
      } else {
          const newTask: Task = {
              id: `t-${Date.now()}`,
              title: taskData.title || 'Nova Tarefa',
              description: taskData.description || '',
              status: taskData.status || 'todo',
              priority: taskData.priority || 'medium',
              assigneeId: taskData.assigneeId || currentUser.id,
              creatorId: currentUser.id,
              createdAt: new Date(),
              dueDate: taskData.dueDate,
              tags: taskData.tags || [],
              attachments: taskData.attachments || [],
              comments: [],
              history: [{ id: `h-${Date.now()}`, userId: currentUser.id, action: 'Criou a tarefa', timestamp: new Date() }]
          };
          setTasks(prev => [newTask, ...prev]);
      }
      setShowTaskModal(false);
      setEditingTask(null);
  };

  const handleTaskComment = (taskId: string, text: string) => {
      const mentionMatches = text.match(/@(\w+)/g);
      const mentionedUserIds: string[] = [];
      
      if (mentionMatches) {
          mentionMatches.forEach(match => {
              const name = match.substring(1).toLowerCase();
              const user = office.users.find(u => u.name.toLowerCase().split(' ')[0] === name);
              if (user && user.id !== currentUser.id) {
                  mentionedUserIds.push(user.id);
                  setLocalNotifications(prev => [{
                      id: `notif-${Date.now()}`,
                      text: `${currentUser.name} mencionou você em uma tarefa.`,
                      type: 'task',
                      referenceId: taskId
                  }, ...prev]);
                  setHasNotifications(true);
              }
          });
      }

      const newComment: TaskComment = {
          id: `c-${Date.now()}`,
          userId: currentUser.id,
          text,
          createdAt: new Date(),
          mentions: mentionedUserIds
      };

      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: [...t.comments, newComment] } : t));
  };

  const handleTaskClick = (task: Task) => {
      setEditingTask(task);
      setShowTaskModal(true);
  };

  const handleNotificationClick = (notif: typeof localNotifications[0]) => {
      if (notif.type === 'task' && notif.referenceId) {
          const task = tasks.find(t => t.id === notif.referenceId);
          if (task) {
              setEditingTask(task);
              setShowTaskModal(true);
              setSidebarMode('hidden'); 
          }
      }
      setLocalNotifications(prev => prev.filter(n => n.id !== notif.id));
  };

  const activeChannel = useMemo(() => channels.find(c => c.id === activeChannelId), [channels, activeChannelId]);
  
  const getDrawerClasses = (mode: SidebarMode) => {
      const baseClasses = "fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out border-l border-slate-200 flex flex-col";
      if (mode === 'hidden') return `${baseClasses} translate-x-full`;
      
      let widthClass = 'w-full md:w-[800px]';
      if (mode === 'chat' && chatFullScreen) widthClass = 'w-full';
      if (mode === 'tasks') widthClass = taskFullScreen ? 'w-full' : 'w-full md:w-[900px]';
      
      return `${baseClasses} ${widthClass} translate-x-0`;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
      <aside className="w-20 md:w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-40 shadow-xl transition-all duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <Briefcase className="text-white" size={20} />
          </div>
          <span className="font-bold text-slate-800 text-lg hidden md:block truncate">{office.name}</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <SidebarButton active={sidebarMode === 'chat'} icon={MessageSquare} label="Chat" onClick={handleToggleChat} badge={channels.reduce((acc, c) => acc + (c.unreadCount || 0), 0) || undefined} />
            <SidebarButton active={sidebarMode === 'tasks'} icon={ClipboardList} label="Tarefas" onClick={handleToggleTasks} />
            <SidebarButton active={sidebarMode === 'notifications'} icon={Megaphone} label="Comunicados" onClick={handleToggleNotifications} notificationDot={hasNotifications || localNotifications.length > 0} />
            {isAdmin && <SidebarButton active={false} icon={Settings} label="Configurações" onClick={() => setShowSettingsModal(true)} />}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/50">
           <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm relative group cursor-pointer hover:border-indigo-200 transition-colors">
              <div className="flex items-center gap-3" onClick={() => setShowStatusMenu(!showStatusMenu)}>
                  <div className="relative shrink-0">
                    <img src={currentUser.avatar} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" alt="Me" />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${STATUS_CONFIG[currentUser.status].color}`}></span>
                  </div>
                  <div className="overflow-hidden hidden md:block flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">{currentUser.name}</p>
                      <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-1">
                         {STATUS_CONFIG[currentUser.status].label}
                         <ChevronDown size={12} />
                      </p>
                  </div>
              </div>
              
              {showStatusMenu && (
                  <div className="absolute bottom-full left-0 w-60 bg-white rounded-xl shadow-xl border border-slate-200 mb-3 p-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                      <div className="p-2 border-b border-slate-100 mb-1">
                          <button onClick={() => { setShowEditProfileModal(true); setShowStatusMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-indigo-600 font-bold hover:bg-indigo-50 rounded-lg flex items-center gap-2">
                              <Edit2 size={14}/> Editar Perfil
                          </button>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase px-2 py-1 mb-1">Set Status</p>
                      {(Object.keys(STATUS_CONFIG) as UserStatus[]).map(s => (
                          <button key={s} onClick={() => { onUpdateStatus(s); setShowStatusMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex items-center gap-3 transition-colors">
                              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[s].color}`}></span>
                              {STATUS_CONFIG[s].label}
                          </button>
                      ))}
                  </div>
              )}
           </div>
           
           <button onClick={onLogout} className="w-full mt-3 flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 text-sm font-semibold transition-colors py-2 rounded-lg hover:bg-red-50" title="Sign Out">
              <LogOut size={18} /> <span className="hidden md:block">Sair</span>
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-slate-50">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative w-full max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="text" placeholder="Pesquisar colegas, salas..." className="w-full pl-12 pr-4 py-3 bg-slate-100/50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
            </div>
            <div className="hidden md:block text-slate-400 font-medium text-sm">
                 {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 scroll-smooth space-y-10 w-full">
            <section className="animate-fade-in-up">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Monitor className="text-indigo-600" size={24} /> Salas de Reunião
                    </h3>
                    {isAdmin && (
                        <button onClick={() => setShowCreateRoomModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
                            <Plus size={16} /> Nova Sala
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {office.rooms.map(room => {
                        const IconComponent = room.icon && ROOM_ICONS[room.icon] ? ROOM_ICONS[room.icon] : ROOM_ICONS['default'];
                        return (
                            <div key={room.id} className="rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group bg-white" style={{ background: room.backgroundImage ? `linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), url(${room.backgroundImage})` : 'white', backgroundSize: 'cover', backgroundPosition: 'center', borderColor: room.color ? `${room.color}40` : undefined }}>
                                 <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110 opacity-10" style={{ backgroundColor: room.color || '#cbd5e1' }}></div>
                                 <div className="absolute top-4 right-4 flex gap-2">
                                     {room.isRestricted && <div className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 border border-slate-100 flex items-center gap-1 z-10 shadow-sm"><Lock size={12} /></div>}
                                     {isAdmin && (
                                         <button onClick={(e) => { e.stopPropagation(); onDeleteRoom(room.id); }} className="bg-white/80 backdrop-blur p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-100 z-10 shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                     )}
                                 </div>
                                 <div className="relative z-10">
                                     <div className="flex items-start justify-between mb-4">
                                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg`} style={{ backgroundColor: room.color || '#64748b' }}>{room.participants.length > 0 ? <Users size={24} /> : <IconComponent size={24} />}</div>
                                     </div>
                                     <h3 className="text-xl font-bold text-slate-800 mb-1">{room.name}</h3>
                                     <div className="flex items-center gap-2 mb-8"><span className={`w-2 h-2 rounded-full ${room.participants.length > 0 ? 'bg-green-500' : 'bg-slate-300'}`}></span><p className="text-sm text-slate-500 font-medium">{room.type === 'fixed' ? 'Espaço Aberto' : 'Escritório Privado'}</p></div>
                                     <div className="flex items-center justify-between">
                                        <div className="flex -space-x-3 h-10">
                                            {room.participants.slice(0, 5).map(pid => { const p = office.users.find(u => u.id === pid); if (!p) return null; return <img key={pid} src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" title={p.name} /> })}
                                            {room.participants.length === 0 && <span className="text-sm text-slate-400 italic py-2">Vazia</span>}
                                        </div>
                                        <button onClick={() => onEnterRoom(room)} disabled={room.isRestricted && room.participants.length === 0} className="px-6 py-2.5 rounded-xl text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none" style={{ backgroundColor: room.color || '#0f172a' }}>Entrar</button>
                                     </div>
                                 </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="animate-fade-in-up animation-delay-200 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-indigo-600" size={24} /> Colaboradores</h3>
                    <div className="flex flex-wrap items-center gap-4">
                       <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide max-w-[60vw]">
                           <button onClick={() => setSelectedSector('all')} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-sm whitespace-nowrap ${selectedSector === 'all' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Todos</button>
                           {office.sectors.map(sector => (
                               <button key={sector.id} onClick={() => setSelectedSector(sector.id)} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-sm whitespace-nowrap flex items-center gap-2 ${selectedSector === sector.id ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><span className={`w-2 h-2 rounded-full ${sector.color.replace('bg-', 'bg-')}`}></span>{sector.name}</button>
                           ))}
                       </div>
                       <div className="flex bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm">
                           <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Briefcase size={20} /></button>
                           <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Users size={20} /></button>
                       </div>
                    </div>
                </div>

                <div className="space-y-8">
                     {selectedSector === 'all' && viewMode === 'grid' ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                            {filteredUsers.map(user => (
                                <UserCard key={user.id} user={user} sectorName={office.sectors.find(s => s.id === user.sector)?.name} roomName={user.currentRoomId ? office.rooms.find(r => r.id === user.currentRoomId)?.name : undefined} onStartCall={() => onStartCall(user)} onKnock={() => onKnock(user)} onOpenChat={() => handleOpenChatWithUser(user)} />
                            ))}
                        </div>
                     ) : (
                        office.sectors.filter(s => selectedSector === 'all' || selectedSector === s.id).map(sector => {
                            const users = usersBySector[sector.id] || [];
                            if (users.length === 0) return null;
                            return (
                                <div key={sector.id} className="animate-fade-in-up">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`w-3 h-3 rounded-full ${sector.color}`}></div>
                                        <h3 className="text-slate-800 text-lg font-bold">{sector.name}</h3>
                                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{users.length}</span>
                                    </div>
                                    <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"}>
                                        {users.map(user => (
                                            viewMode === 'grid' ? <UserCard key={user.id} user={user} sectorName={sector.name} roomName={user.currentRoomId ? office.rooms.find(r => r.id === user.currentRoomId)?.name : undefined} onStartCall={() => onStartCall(user)} onKnock={() => onKnock(user)} onOpenChat={() => handleOpenChatWithUser(user)} /> : <UserListItem key={user.id} user={user} sectorName={sector.name} roomName={user.currentRoomId ? office.rooms.find(r => r.id === user.currentRoomId)?.name : undefined} onStartCall={() => onStartCall(user)} onKnock={() => onKnock(user)} onOpenChat={() => handleOpenChatWithUser(user)} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                     )}
                </div>
            </section>
        </div>
      </main>

      <div className={getDrawerClasses(sidebarMode)}>
         <div className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
             <div className="flex items-center gap-3">
                 {(sidebarMode === 'chat' && activeChannelId) && (
                     <button onClick={() => setActiveChannelId(null)} className="md:hidden p-1 hover:bg-slate-100 rounded-full text-slate-500">
                         <ChevronLeft size={20} />
                     </button>
                 )}
                 <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-800 text-lg">
                         {sidebarMode === 'chat' && (activeChannel ? (activeChannel.name || 'Chat') : 'Mensagens')}
                         {sidebarMode === 'notifications' && 'Comunicados'}
                         {sidebarMode === 'tasks' && 'Gestão de Tarefas'}
                     </span>
                     {sidebarMode === 'chat' && activeChannel && activeChannel.type === 'dm' && (
                         <span className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG['online'].color}`}></span>
                     )}
                 </div>
             </div>
             <div className="flex items-center gap-1">
                 {sidebarMode === 'chat' && activeChannel && (
                     <button onClick={() => setShowAddPeopleModal(true)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 mr-2" title="Adicionar Pessoas"><UserPlus size={18} /></button>
                 )}
                 {sidebarMode === 'chat' && (
                     <button onClick={() => setChatFullScreen(!chatFullScreen)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500" title="Tela Cheia">
                         {chatFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                     </button>
                 )}
                 {sidebarMode === 'notifications' && isAdmin && (
                     <button onClick={() => setShowComposeAnnouncement(true)} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-full" title="Criar Comunicado">
                         <Plus size={20} />
                     </button>
                 )}
                 {sidebarMode === 'tasks' && (
                     <>
                        <button onClick={() => setTaskFullScreen(!taskFullScreen)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 mr-2" title={taskFullScreen ? "Sair Tela Cheia" : "Tela Cheia"}>
                             {taskFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button onClick={() => { setEditingTask(null); setShowTaskModal(true); }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-indigo-700 transition-colors mr-2">
                            <Plus size={16} /> Nova Tarefa
                        </button>
                     </>
                 )}
                 <button onClick={() => setSidebarMode('hidden')} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-slate-500 transition-colors">
                     <X size={18} />
                 </button>
             </div>
         </div>

         <div className="flex-1 flex overflow-hidden">
             {sidebarMode === 'chat' && (
                 <>
                    <div className={`flex flex-col bg-slate-50/50 border-r border-slate-200 overflow-y-auto transition-all w-full md:w-72 shrink-0 ${activeChannelId ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-4 space-y-2">
                            <button onClick={() => setShowNewDMModal(true)} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 font-semibold flex items-center justify-center gap-2 transition-all"><MessageSquare size={16} /> Nova Conversa</button>
                            <button onClick={() => setShowCreateGroupModal(true)} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold flex items-center justify-center gap-2 transition-all"><Hash size={16} /> Criar Espaço</button>
                        </div>
                        <div className="flex-1 px-2 space-y-6 pb-4">
                            <div>
                                <div className="px-4 py-2 flex items-center justify-between group"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Espaços</p></div>
                                <div className="space-y-0.5">
                                    {sortedChannels.filter(c => c.type === 'group').map(c => (
                                        <button key={c.id} onClick={() => setActiveChannelId(c.id)} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-left ${activeChannelId === c.id ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-slate-100 text-slate-700'}`}><Hash size={16} className="text-slate-400" /><span className="text-sm font-medium truncate">{c.name}</span>{c.unreadCount ? <span className="ml-auto bg-indigo-600 text-white text-[10px] font-bold px-1.5 rounded-full">{c.unreadCount}</span> : null}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="px-4 py-2 flex items-center justify-between group"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mensagens Diretas</p></div>
                                <div className="space-y-0.5">
                                    {sortedChannels.filter(c => c.type === 'dm').map(c => {
                                        const otherUserId = c.participants.find(p => p !== currentUser.id);
                                        const otherUser = office.users.find(u => u.id === otherUserId);
                                        if (!otherUser) return null;
                                        return (
                                            <button key={c.id} onClick={() => setActiveChannelId(c.id)} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-left group ${activeChannelId === c.id ? 'bg-indigo-50' : 'hover:bg-slate-100'}`}>
                                                <div className="relative"><img src={otherUser.avatar} className="w-8 h-8 rounded-full object-cover" /><span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${STATUS_CONFIG[otherUser.status].color}`}></span></div>
                                                <div className="flex-1 min-w-0"><div className="flex justify-between items-baseline"><p className={`font-medium text-sm truncate ${activeChannelId === c.id ? 'text-indigo-900 font-bold' : 'text-slate-700'}`}>{otherUser.name}</p>{c.lastMessageAt && <span className="text-[10px] text-slate-400">{c.lastMessageAt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}</div><p className="text-xs text-slate-500 truncate">{c.messages[c.messages.length - 1]?.text || 'Inicie a conversa...'}</p></div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`flex flex-col flex-1 bg-white relative ${!activeChannelId ? 'hidden md:flex' : 'flex'}`}>
                         {activeChannel ? (
                             <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                                    {activeChannel.messages.map((msg, idx) => {
                                        const isMe = msg.senderId === currentUser.id;
                                        const sender = office.users.find(u => u.id === msg.senderId);
                                        const showHeader = idx === 0 || activeChannel.messages[idx - 1].senderId !== msg.senderId;
                                        return (
                                            <div key={msg.id} className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`flex max-w-[85%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    {!isMe && showHeader ? (<img src={sender?.avatar} className="w-8 h-8 rounded-full object-cover mt-1" />) : (!isMe ? <div className="w-8" /> : null)}
                                                    <div className="flex flex-col gap-1">
                                                        {!isMe && showHeader && (<span className="text-xs font-bold text-slate-600 ml-1">{sender?.name}</span>)}
                                                        <div className={`group relative px-4 py-2 text-sm shadow-sm transition-all ${isMe ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-none'}`}>
                                                            <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                                                            <div className={`flex items-center gap-1 text-[10px] mt-1 ${isMe ? 'text-indigo-200 justify-end' : 'text-slate-400 justify-start'}`}>{msg.editedAt && <span className="italic">(editado)</span>}<span>{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>{isMe && <CheckCheck size={12} className="opacity-70" />}</div>
                                                            {isMe && (<div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-white border border-slate-200 shadow-sm rounded-lg absolute -top-3 right-0 scale-90"><button onClick={() => { setChatMessageInput(msg.text); setEditingMessageId(msg.id); }} className="p-1 hover:bg-slate-100 text-slate-500 rounded-l-lg" title="Editar"><Edit2 size={10} /></button><button onClick={() => handleDeleteMessage(msg.id)} className="p-1 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-r-lg" title="Excluir"><Trash2 size={10} /></button></div>)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 border-t border-slate-100 bg-white relative">
                                    {mentionQuery !== null && (
                                        <div className="absolute bottom-full left-4 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-20">
                                            <div className="p-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500">Mencionar...</div>
                                            {office.users.filter(u => u.name.toLowerCase().includes(mentionQuery)).slice(0, 5).map(u => (
                                                <button key={u.id} onClick={() => insertMention(u)} className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2 text-sm"><img src={u.avatar} className="w-6 h-6 rounded-full" /><span className="text-slate-700 font-medium">{u.name}</span></button>
                                            ))}
                                        </div>
                                    )}
                                    {editingMessageId && (<div className="flex items-center justify-between text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-t-lg border-x border-t border-indigo-100"><span className="font-semibold flex items-center gap-1"><Edit2 size={10} /> Editando mensagem</span><button onClick={() => { setEditingMessageId(null); setChatMessageInput(''); }} className="hover:underline">Cancelar</button></div>)}
                                    <form onSubmit={handleSendMessage} className={`bg-white border rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-sm ${editingMessageId ? 'border-indigo-300 rounded-tl-none' : 'border-slate-300'}`}>
                                        <input type="text" className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none placeholder-slate-400 text-slate-700" placeholder={editingMessageId ? "Edite sua mensagem..." : `Mensagem em ${activeChannel.name || 'Chat'}...`} value={chatMessageInput} onChange={handleInputChange} />
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <div className="flex gap-1 text-slate-400"><button type="button" className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><Plus size={18} /></button><button type="button" className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><ImageIcon size={18} /></button><button type="button" className="p-1.5 hover:bg-slate-100 rounded-full transition-colors" title="Mencionar (@)"><AtSign size={18} /></button></div>
                                            <div className="flex items-center gap-2"><button type="button" onClick={() => { if(activeChannel.type === 'dm') { const pid = activeChannel.participants.find(id => id !== currentUser.id); if(pid) onStartCall(office.users.find(u => u.id === pid)!); } }} className="p-2 hover:bg-slate-100 text-slate-500 rounded-full transition-colors" title="Iniciar Chamada"><Video size={18} /></button><button type="submit" disabled={!chatMessageInput.trim()} className="p-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all">{editingMessageId ? <Check size={16} /> : <Send size={16} />}</button></div>
                                        </div>
                                    </form>
                                </div>
                             </>
                         ) : (
                             <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/30"><div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100"><MessageSquare size={48} className="text-slate-200" /></div><p className="font-medium text-slate-400">Selecione uma conversa ou crie um espaço</p></div>
                         )}
                    </div>
                 </>
             )}

             {sidebarMode === 'notifications' && (
                 <div className="w-full h-full bg-slate-50 overflow-y-auto">
                     <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between"><h3 className="font-bold text-slate-700">Comunicados</h3></div>
                        {localNotifications.length > 0 && (
                            <div className="space-y-2">
                                {localNotifications.map(n => (
                                    <div key={n.id} onClick={() => handleNotificationClick(n)} className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl cursor-pointer hover:bg-indigo-100 transition-colors">
                                        <div className="flex gap-2">
                                            <Bell size={16} className="text-indigo-600 mt-0.5" />
                                            <p className="text-sm text-indigo-900">{n.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {announcements.length === 0 && localNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                <Megaphone size={48} className="mb-4 opacity-20" />
                                <p>Nenhum comunicado recente.</p>
                            </div>
                        ) : (
                             announcements.map(ann => {
                                 const sender = office.users.find(u => u.id === ann.senderId);
                                 return (
                                    <div key={ann.id} onClick={() => setActiveAnnouncement(ann)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg"><Megaphone size={16} /></div>
                                                <span className="font-bold text-slate-800 text-sm">{sender?.name || 'Sistema'}</span>
                                            </div>
                                            <span className="text-xs text-slate-400">{ann.createdAt.toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="font-bold text-slate-700 mb-1">{ann.title}</h4>
                                        <p className="text-sm text-slate-500 line-clamp-2">{ann.message}</p>
                                    </div>
                                 );
                             })
                        )}
                     </div>
                 </div>
             )}

             {sidebarMode === 'tasks' && (
                 <div className="w-full h-full bg-slate-100 flex flex-col">
                     <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                         <div className="flex items-center bg-slate-100 rounded-lg p-1">
                             <button onClick={() => setTaskViewMode('list')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${taskViewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={14}/> Lista</button>
                             <button onClick={() => setTaskViewMode('kanban')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${taskViewMode === 'kanban' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Kanban size={14}/> Kanban</button>
                             <button onClick={() => setTaskViewMode('calendar')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${taskViewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><CalendarIcon size={14}/> Calendário</button>
                         </div>
                         <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-400 uppercase mr-2">{tasks.length} Tarefas</span>
                         </div>
                     </div>
                     
                     <div className="flex-1 overflow-auto p-4">
                         {taskViewMode === 'list' && (
                             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                 <table className="w-full text-left">
                                     <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
                                         <tr>
                                             <th className="px-6 py-3">Tarefa</th>
                                             <th className="px-6 py-3">Status</th>
                                             <th className="px-6 py-3">Prioridade</th>
                                             <th className="px-6 py-3">Responsável</th>
                                             <th className="px-6 py-3">Prazo</th>
                                         </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                         {tasks.map(task => {
                                             const assignee = office.users.find(u => u.id === task.assigneeId);
                                             const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
                                             return (
                                                 <tr key={task.id} onClick={() => handleTaskClick(task)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                                                     <td className="px-6 py-4">
                                                         <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-600">{task.title}</p>
                                                         <div className="flex gap-2 mt-1">
                                                             {task.tags.map(t => <span key={t} className="text-[10px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Tag size={10}/> {t}</span>)}
                                                         </div>
                                                     </td>
                                                     <td className="px-6 py-4">
                                                         <span className={`px-2 py-1 rounded-md text-xs font-bold border ${TASK_STATUS_CONFIG[task.status].bg} ${TASK_STATUS_CONFIG[task.status].color} ${TASK_STATUS_CONFIG[task.status].border}`}>
                                                             {TASK_STATUS_CONFIG[task.status].label}
                                                         </span>
                                                     </td>
                                                     <td className="px-6 py-4">
                                                         <span className={`px-2 py-1 rounded-md text-xs font-bold ${TASK_PRIORITY_CONFIG[task.priority].color}`}>
                                                             {TASK_PRIORITY_CONFIG[task.priority].label}
                                                         </span>
                                                     </td>
                                                     <td className="px-6 py-4">
                                                         {assignee ? (
                                                             <div className="flex items-center gap-2">
                                                                 <img src={assignee.avatar} className="w-6 h-6 rounded-full" />
                                                                 <span className="text-sm text-slate-700 font-medium">{assignee.name}</span>
                                                             </div>
                                                         ) : <span className="text-slate-400 text-xs">Não atribuído</span>}
                                                     </td>
                                                     <td className="px-6 py-4">
                                                         <div className={`flex items-center gap-1 text-sm font-semibold ${isOverdue ? 'text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100 w-fit' : 'text-slate-600'}`}>
                                                             {isOverdue && <AlertCircle size={14} />}
                                                             <span className={isOverdue ? '' : 'flex items-center gap-1'}><CalendarIcon size={14} className={isOverdue ? 'hidden' : ''}/> {task.dueDate ? task.dueDate.toLocaleString(undefined, {dateStyle: 'short', timeStyle: 'short'}) : '-'}</span>
                                                         </div>
                                                     </td>
                                                 </tr>
                                             );
                                         })}
                                     </tbody>
                                 </table>
                             </div>
                         )}

                         {taskViewMode === 'kanban' && (
                             <div className="flex h-full gap-4 overflow-x-auto pb-4">
                                 {(Object.keys(TASK_STATUS_CONFIG) as TaskStatus[]).map(status => (
                                     <div key={status} className="flex-1 min-w-[280px] flex flex-col bg-slate-100 rounded-2xl border border-slate-300">
                                         <div className={`p-3 border-b border-slate-200 font-bold text-sm text-slate-800 flex justify-between items-center rounded-t-2xl ${TASK_STATUS_CONFIG[status].bg}`}>
                                             {TASK_STATUS_CONFIG[status].label}
                                             <span className="bg-white px-2 py-0.5 rounded-full text-xs shadow-sm text-slate-600 border border-slate-200">{tasks.filter(t => t.status === status).length}</span>
                                         </div>
                                         <div className="p-3 space-y-3 overflow-y-auto flex-1 bg-slate-100/50">
                                             {tasks.filter(t => t.status === status).map(task => {
                                                  const assignee = office.users.find(u => u.id === task.assigneeId);
                                                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
                                                  return (
                                                     <div key={task.id} onClick={() => handleTaskClick(task)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all group">
                                                         <div className="flex justify-between items-start mb-3">
                                                             <div className="flex gap-1">
                                                                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TASK_PRIORITY_CONFIG[task.priority].color}`}>{TASK_PRIORITY_CONFIG[task.priority].label}</span>
                                                                 {isOverdue && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 flex items-center gap-1 border border-red-200"><AlertCircle size={10}/> Atrasado</span>}
                                                             </div>
                                                         </div>
                                                         <p className="font-bold text-slate-800 text-sm mb-3 leading-snug">{task.title}</p>
                                                         
                                                         <div className="flex flex-wrap gap-1 mb-3">
                                                             {task.tags.map(t => <span key={t} className="text-[10px] font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">{t}</span>)}
                                                         </div>

                                                         <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                                             <div className="flex items-center gap-2">
                                                                 {assignee ? (
                                                                     <>
                                                                     <img src={assignee.avatar} className="w-6 h-6 rounded-full border border-slate-100" title={assignee.name} />
                                                                     <span className="text-xs text-slate-500 font-medium truncate max-w-[80px]">{assignee.name.split(' ')[0]}</span>
                                                                     </>
                                                                 ) : <span className="text-xs text-slate-300 italic">Sem dono</span>}
                                                             </div>
                                                             <div className="flex gap-3 text-slate-400">
                                                                 {task.dueDate && <span className={`flex items-center gap-1 text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}><CalendarIcon size={12}/> {task.dueDate.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>}
                                                                 {(task.comments.length > 0 || task.attachments.length > 0) && (
                                                                     <div className="flex gap-2">
                                                                         {task.comments.length > 0 && <span className="flex items-center gap-0.5 text-[10px]"><MessageSquare size={12}/> {task.comments.length}</span>}
                                                                         {task.attachments.length > 0 && <span className="flex items-center gap-0.5 text-[10px]"><Paperclip size={12}/> {task.attachments.length}</span>}
                                                                     </div>
                                                                 )}
                                                             </div>
                                                         </div>
                                                     </div>
                                                  );
                                             })}
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}

                         {taskViewMode === 'calendar' && (
                             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-full overflow-hidden flex flex-col">
                                 <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden flex-1">
                                     {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                         <div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500 uppercase">{d}</div>
                                     ))}
                                     {Array.from({length: 35}).map((_, i) => {
                                         const day = i - 2; 
                                         const date = new Date();
                                         date.setDate(day);
                                         const dayTasks = tasks.filter(t => t.dueDate && t.dueDate.getDate() === date.getDate() && t.dueDate.getMonth() === date.getMonth());
                                         
                                         return (
                                             <div key={i} className={`bg-white p-2 min-h-[80px] border-t border-slate-100 relative group overflow-y-auto ${day > 0 && day <= 31 ? '' : 'bg-slate-50/50'}`}>
                                                 {day > 0 && day <= 31 && <span className={`text-xs font-bold absolute top-1 right-2 ${dayTasks.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{day}</span>}
                                                 <div className="mt-4 space-y-1">
                                                     {dayTasks.map(t => (
                                                         <div key={t.id} onClick={() => handleTaskClick(t)} className={`text-[10px] truncate px-1.5 py-1 rounded cursor-pointer border ${TASK_STATUS_CONFIG[t.status].bg} ${TASK_STATUS_CONFIG[t.status].color} ${TASK_STATUS_CONFIG[t.status].border} font-bold shadow-sm`}>
                                                             {t.title}
                                                         </div>
                                                     ))}
                                                 </div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
             )}
         </div>
      </div>

      {showTaskModal && (
          <TaskModal 
              task={editingTask}
              users={office.users}
              currentUser={currentUser}
              onClose={() => setShowTaskModal(false)}
              onSave={handleSaveTask}
              onComment={handleTaskComment}
          />
      )}

      {showCreateRoomModal && isAdmin && (
          <CreateRoomModal onClose={() => setShowCreateRoomModal(false)} onCreate={(data) => { onCreateRoom(data); setShowCreateRoomModal(false); }} />
      )}

      {showCreateGroupModal && (
          <CreateGroupModal 
            users={office.users.filter(u => u.id !== currentUser.id)}
            onClose={() => setShowCreateGroupModal(false)}
            onCreate={(name, selectedUsers) => handleCreateGroup(name, selectedUsers)}
          />
      )}

      {showAddPeopleModal && activeChannel && (
          <AddPeopleModal
            users={office.users.filter(u => u.id !== currentUser.id && !activeChannel.participants.includes(u.id))}
            onClose={() => setShowAddPeopleModal(false)}
            onAdd={(selectedUsers) => handleAddPeopleToChat(selectedUsers)}
          />
      )}

      {showNewDMModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Nova Mensagem Direta</h3><button onClick={() => setShowNewDMModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={20} /></button></div>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {office.users.filter(u => u.id !== currentUser.id).map(u => (
                         <button key={u.id} onClick={() => handleOpenChatWithUser(u)} className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                             <img src={u.avatar} className="w-10 h-10 rounded-full" />
                             <div>
                                 <p className="font-semibold text-slate-800 text-sm">{u.name}</p>
                                 <p className="text-xs text-slate-500">{u.email}</p>
                             </div>
                         </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {showComposeAnnouncement && isAdmin && (
          <ComposeAnnouncementModal 
            users={office.users}
            onClose={() => setShowComposeAnnouncement(false)}
            onSend={handleSendAnnouncement}
          />
      )}

      {activeAnnouncement && (
          <AnnouncementOverlay 
            announcement={activeAnnouncement}
            onClose={() => setActiveAnnouncement(null)}
          />
      )}

      {showSettingsModal && isAdmin && (
          <SettingsModal 
              office={office}
              onClose={() => setShowSettingsModal(false)}
              onUpdateOffice={onUpdateOffice}
              onUpdateUser={onUpdateUser}
              onCreateUser={onCreateUser}
              onDeleteUser={onDeleteUser}
              onCreateInvite={onCreateInvite}
          />
      )}

      {showEditProfileModal && (
          <EditProfileModal 
              user={currentUser}
              onClose={() => setShowEditProfileModal(false)}
              onUpdate={onUpdateUser}
          />
      )}

    </div>
  );
};

const SettingsModal: React.FC<{
    office: Office;
    onClose: () => void;
    onUpdateOffice: (data: Partial<Office>) => void;
    onUpdateUser: (user: User) => void;
    onCreateUser: (user: User) => void;
    onDeleteUser: (userId: string) => void;
    onCreateInvite: (durationInMinutes: number) => VisitorInvite;
}> = ({ office, onClose, onUpdateOffice, onUpdateUser, onCreateUser, onDeleteUser, onCreateInvite }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'users' | 'sectors' | 'schedule' | 'visitors'>('general');
    
    // General State
    const [officeName, setOfficeName] = useState(office.name);
    const [logoUrl, setLogoUrl] = useState(office.logo);
    const [color, setColor] = useState(office.primaryColor || '#4f46e5');

    // Schedule State
    const [startHour, setStartHour] = useState(office.workingHours?.start || '09:00');
    const [endHour, setEndHour] = useState(office.workingHours?.end || '18:00');
    const [scheduleEnabled, setScheduleEnabled] = useState(office.workingHours?.enabled || false);

    // User Management State
    const [formData, setFormData] = useState<Partial<User>>({ role: 'user', sector: office.sectors[0]?.id });
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    // Visitor State
    const [inviteDuration, setInviteDuration] = useState<number>(24); // Hours
    const [lastCreatedInvite, setLastCreatedInvite] = useState<VisitorInvite | null>(null);

    const handleSaveGeneral = () => {
        onUpdateOffice({ name: officeName, logo: logoUrl, primaryColor: color });
        alert('Alterações salvas com sucesso!'); // Feedback
    };

    const handleSaveSchedule = () => {
        onUpdateOffice({ workingHours: { enabled: scheduleEnabled, start: startHour, end: endHour } });
        alert('Horário de funcionamento atualizado!');
    };

    const handleGenerateInvite = () => {
        const invite = onCreateInvite(inviteDuration * 60); // Convert hours to minutes
        setLastCreatedInvite(invite);
    };

    const startEditUser = (user: User) => {
        setFormData(user);
        setEditingUserId(user.id);
        setIsFormOpen(true);
    };

    const handleUserSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Check required fields (Sector needs fallback if not set but default exists)
        const userSector = formData.sector || office.sectors[0]?.id;
        
        if (formData.name && formData.email && userSector) {
            if (editingUserId) {
                // Update Existing
                onUpdateUser({
                    ...formData,
                    id: editingUserId,
                    avatar: formData.avatar || `https://ui-avatars.com/api/?name=${formData.name}&background=random`,
                    status: formData.status || 'offline',
                    sector: userSector
                } as User);
            } else {
                // Create New
                onCreateUser({
                    id: `u-${Date.now()}`,
                    name: formData.name!,
                    email: formData.email!,
                    avatar: `https://ui-avatars.com/api/?name=${formData.name}&background=random`,
                    role: formData.role as any || 'user',
                    sector: userSector,
                    jobTitle: formData.jobTitle,
                    status: 'offline'
                });
            }
            setIsFormOpen(false);
            setEditingUserId(null);
            setFormData({ role: 'user', sector: office.sectors[0]?.id });
        } else {
            alert("Preencha os campos obrigatórios (Nome, Email, Setor).");
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-fade-in-up flex flex-col h-[85vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl shrink-0">
                    <div className="flex items-center gap-3"><div className="bg-slate-800 text-white p-2 rounded-lg"><Settings size={20} /></div><h3 className="text-xl font-bold text-slate-800">Configurações do Escritório</h3></div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    <aside className="w-64 bg-slate-50 border-r border-slate-200 p-4 space-y-1">
                        {[
                            { id: 'general', label: 'Geral', icon: Briefcase },
                            { id: 'users', label: 'Usuários', icon: Users },
                            { id: 'sectors', label: 'Setores', icon: Layers },
                            { id: 'schedule', label: 'Horários', icon: Clock },
                            { id: 'visitors', label: 'Visitantes', icon: QrCode },
                        ].map(item => (
                            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === item.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-white/50'}`}>
                                <item.icon size={18} /> {item.label}
                            </button>
                        ))}
                    </aside>
                    <div className="flex-1 p-8 overflow-y-auto">
                        {activeTab === 'general' && (
                            <div className="space-y-6 max-w-lg">
                                <div><label className="block text-sm font-bold text-slate-700 mb-1">Nome do Escritório</label><input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-xl bg-white text-black" value={officeName} onChange={e => setOfficeName(e.target.value)} /></div>
                                <div><label className="block text-sm font-bold text-slate-700 mb-1">Logo URL</label><input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-xl bg-white text-black" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} /></div>
                                <div><label className="block text-sm font-bold text-slate-700 mb-1">Cor Primária</label><div className="flex items-center gap-2"><input type="color" className="h-10 w-10 border-0 rounded cursor-pointer" value={color} onChange={e => setColor(e.target.value)} /><input type="text" className="w-32 px-4 py-2 border border-slate-300 rounded-xl uppercase bg-white text-black" value={color} onChange={e => setColor(e.target.value)} /></div></div>
                                <button onClick={handleSaveGeneral} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow hover:bg-indigo-700">Salvar Alterações</button>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-slate-800">Gerenciar Usuários ({office.users.length})</h4>
                                    <button onClick={() => { setEditingUserId(null); setFormData({ role: 'user', sector: office.sectors[0]?.id }); setIsFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors"><UserAdd size={16} /> Novo Usuário</button>
                                </div>
                                
                                {isFormOpen && (
                                    <form onSubmit={handleUserSubmit} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 shadow-inner relative">
                                        <div className="absolute top-4 right-4"><button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-red-500"><X size={20} /></button></div>
                                        <h5 className="col-span-2 text-sm font-bold text-slate-500 uppercase mb-2">{editingUserId ? 'Editar Usuário' : 'Novo Usuário'}</h5>
                                        
                                        <div><label className="text-xs font-bold text-slate-500">Nome</label><input required className="w-full px-3 py-2 border rounded-lg bg-white text-black" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                                        <div><label className="text-xs font-bold text-slate-500">Email</label><input required type="email" className="w-full px-3 py-2 border rounded-lg bg-white text-black" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                                        <div><label className="text-xs font-bold text-slate-500">Cargo</label><input className="w-full px-3 py-2 border rounded-lg bg-white text-black" value={formData.jobTitle || ''} onChange={e => setFormData({...formData, jobTitle: e.target.value})} /></div>
                                        <div><label className="text-xs font-bold text-slate-500">Setor</label>
                                            <select className="w-full px-3 py-2 border rounded-lg bg-white text-black" value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})}>
                                                {office.sectors.map(s => <option key={s.id} value={s.id} className="bg-white text-black">{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div><label className="text-xs font-bold text-slate-500">Permissão</label>
                                            <select className="w-full px-3 py-2 border rounded-lg bg-white text-black" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                                                <option value="user" className="bg-white text-black">Usuário</option>
                                                <option value="admin" className="bg-white text-black">Admin</option>
                                            </select>
                                        </div>
                                        
                                        <div className="col-span-2 flex justify-end gap-2 mt-4">
                                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border bg-white rounded-lg text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                                            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700">{editingUserId ? 'Salvar Alterações' : 'Criar Usuário'}</button>
                                        </div>
                                    </form>
                                )}

                                <div className="space-y-3">
                                    {office.users.map(u => {
                                        const sectorName = office.sectors.find(s => s.id === u.sector)?.name || 'Sem Setor';
                                        return (
                                            <div key={u.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <img src={u.avatar} className="w-12 h-12 rounded-full object-cover border border-slate-100" />
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                                                        <p className="text-xs text-slate-500 font-medium">{u.email}</p>
                                                        <div className="flex gap-2 mt-1">
                                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-semibold">{sectorName}</span>
                                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-semibold">{u.jobTitle || 'Sem Cargo'}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{u.role === 'admin' ? 'Admin' : 'Usuário'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditUser(u)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><UserCog size={18}/></button>
                                                    <button onClick={() => onDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={18}/></button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'schedule' && (
                            <div className="space-y-6 max-w-md">
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <Clock size={24} className="text-indigo-600" />
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">Controle de Horário</h4>
                                        <p className="text-xs text-slate-500">Bloquear acesso fora do expediente</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={scheduleEnabled} onChange={e => setScheduleEnabled(e.target.checked)} />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                <div className={`grid grid-cols-2 gap-4 ${!scheduleEnabled && 'opacity-50 pointer-events-none'}`}>
                                    <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Início</label><input type="time" className="w-full p-3 border rounded-xl bg-white text-black" value={startHour} onChange={e => setStartHour(e.target.value)} /></div>
                                    <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Fim</label><input type="time" className="w-full p-3 border rounded-xl bg-white text-black" value={endHour} onChange={e => setEndHour(e.target.value)} /></div>
                                </div>
                                <button onClick={handleSaveSchedule} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow hover:bg-indigo-700 w-full">Atualizar Horários</button>
                            </div>
                        )}

                        {activeTab === 'visitors' && (
                            <div className="space-y-6">
                                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><QrCode size={24}/></div>
                                        <div>
                                            <h4 className="text-lg font-bold text-indigo-900">Gerar Novo Convite</h4>
                                            <p className="text-sm text-indigo-700/80">Crie links temporários de acesso para visitantes.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <select 
                                            className="px-4 py-2 border border-indigo-200 rounded-xl bg-white text-indigo-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={inviteDuration}
                                            onChange={(e) => setInviteDuration(Number(e.target.value))}
                                        >
                                            <option value={1} className="bg-white text-black">1 Hora</option>
                                            <option value={4} className="bg-white text-black">4 Horas</option>
                                            <option value={8} className="bg-white text-black">8 Horas</option>
                                            <option value={24} className="bg-white text-black">24 Horas</option>
                                            <option value={48} className="bg-white text-black">48 Horas</option>
                                        </select>
                                        <button 
                                            onClick={handleGenerateInvite}
                                            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow hover:bg-indigo-700 transition-all flex items-center gap-2"
                                        >
                                            <Plus size={18}/> Gerar
                                        </button>
                                    </div>
                                </div>

                                {lastCreatedInvite && (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex justify-between items-start mb-2">
                                            <h5 className="font-bold text-green-800 flex items-center gap-2"><Check size={16}/> Convite Criado com Sucesso!</h5>
                                            <button onClick={() => setLastCreatedInvite(null)}><X size={16} className="text-green-600 hover:text-green-800"/></button>
                                        </div>
                                        <div className="bg-white border border-green-100 p-3 rounded-lg flex items-center justify-between gap-4">
                                            <code className="text-green-700 font-mono font-bold text-lg tracking-wider">{lastCreatedInvite.code}</code>
                                            <button className="text-xs font-bold text-green-600 hover:underline uppercase" onClick={() => navigator.clipboard.writeText(lastCreatedInvite.code)}>Copiar Código</button>
                                        </div>
                                        <p className="text-xs text-green-600 mt-2">Válido até: {lastCreatedInvite.expiresAt.toLocaleString()}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-800">Convites Ativos ({office.visitorInvites.filter(i => new Date(i.expiresAt) > new Date()).length})</h4>
                                    {office.visitorInvites.filter(i => new Date(i.expiresAt) > new Date()).length === 0 ? (
                                        <p className="text-slate-400 text-sm italic">Nenhum convite ativo no momento.</p>
                                    ) : (
                                        <div className="grid gap-3">
                                            {office.visitorInvites.filter(i => new Date(i.expiresAt) > new Date()).map(invite => (
                                                <div key={invite.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-mono font-bold">{invite.code.slice(0, 2)}</div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 font-mono">{invite.code}</p>
                                                            <p className="text-xs text-slate-500">Expira em: {invite.expiresAt.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${invite.usedBy ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {invite.usedBy ? 'Em Uso' : 'Aguardando'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'sectors' && (
                             <div className="space-y-4">
                                <h4 className="font-bold text-slate-800">Gerenciar Setores</h4>
                                {office.sectors.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                                        <div className="flex items-center gap-3"><div className={`w-4 h-4 rounded-full ${s.color}`}></div><span className="font-medium text-slate-700">{s.name}</span></div>
                                        <button className="text-xs text-indigo-600 font-bold hover:underline">Editar</button>
                                    </div>
                                ))}
                                <button className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-slate-400">+ Adicionar Setor</button>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const EditProfileModal: React.FC<{
    user: User;
    onClose: () => void;
    onUpdate: (user: User) => void;
}> = ({ user, onClose, onUpdate }) => {
    const [name, setName] = useState(user.name);
    const [avatar, setAvatar] = useState(user.avatar);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate({ ...user, name, avatar });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Editar Perfil</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex justify-center mb-4">
                        <img src={avatar} className="w-24 h-24 rounded-full border-4 border-indigo-100 object-cover" />
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label><input type="text" className="w-full p-2 border rounded-lg text-slate-800" value={name} onChange={e => setName(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Avatar URL</label><input type="text" className="w-full p-2 border rounded-lg text-slate-800" value={avatar} onChange={e => setAvatar(e.target.value)} /></div>
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                        <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CreateRoomModal: React.FC<{
    onClose: () => void;
    onCreate: (data: { name: string, color: string, image: string, type: 'fixed' | 'private', icon: string }) => void;
}> = ({ onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'fixed'|'private'>('fixed');
    const [icon, setIcon] = useState('default');
    const handleCreate = () => { if(!name) return; onCreate({ name, type, icon, color: '#6366f1', image: `https://picsum.photos/seed/${name}/400/200` }); };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800">Nova Sala</h3><button onClick={onClose}><X size={20} className="text-slate-400" /></button></div>
                <div className="space-y-4">
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Nome da Sala</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800" autoFocus /></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Tipo</label><div className="flex gap-2"><button onClick={() => setType('fixed')} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${type === 'fixed' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Aberta</button><button onClick={() => setType('private')} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${type === 'private' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Privada</button></div></div>
                    <button onClick={handleCreate} disabled={!name} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">Criar Sala</button>
                </div>
            </div>
        </div>
    )
}

const SidebarButton: React.FC<{ active: boolean; icon: React.ElementType; label: string; onClick: () => void; badge?: number; notificationDot?: boolean; }> = ({ active, icon: Icon, label, onClick, badge, notificationDot }) => (
    <button onClick={onClick} className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all relative group ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`} title={label}>
        <div className="relative"><Icon size={22} />{notificationDot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>}</div>
        <span className="font-semibold text-sm hidden md:block">{label}</span>
        {badge ? (<span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white shadow-sm">{badge > 99 ? '99+' : badge}</span>) : null}
    </button>
);

const UserCard: React.FC<{ user: User; sectorName?: string; roomName?: string; onStartCall: () => void; onKnock: () => void; onOpenChat: () => void; }> = ({ user, sectorName, roomName, onStartCall, onKnock, onOpenChat }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group relative">
        <div className="relative mb-3"><img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover border-4 border-slate-50 shadow-sm" /><span className={`absolute bottom-1 right-1 w-4 h-4 border-2 border-white rounded-full ${STATUS_CONFIG[user.status].color}`}></span></div>
        <h4 className="font-bold text-slate-800 text-lg text-center mb-1">{user.name}</h4>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-4 flex items-center gap-1">
            {user.role === 'visitor' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">Visitante</span>}
            {user.jobTitle || sectorName || user.sector}
        </p>
        {roomName && (<div className="mb-4 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1"><Monitor size={12} /> {roomName}</div>)}
        {user.statusMessage && (<p className="text-xs text-slate-500 italic text-center mb-4 bg-slate-50 px-3 py-1 rounded-lg">"{user.statusMessage}"</p>)}
        <div className="flex gap-2 w-full mt-auto">
            <button onClick={onOpenChat} className="p-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors" title="Chat">
                <MessageSquare size={20}/>
            </button>
            <button onClick={onKnock} className="p-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-amber-600 transition-colors" title="Chamar Atenção">
                <Hand size={20}/>
            </button>
            <button onClick={onStartCall} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors flex items-center justify-center gap-2 font-bold text-sm" title="Entrar">
                <LogIn size={18}/> Entrar
            </button>
        </div>
    </div>
);

const UserListItem: React.FC<{ user: User; sectorName?: string; roomName?: string; onStartCall: () => void; onKnock: () => void; onOpenChat: () => void; }> = ({ user, sectorName, roomName, onStartCall, onKnock, onOpenChat }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-center gap-3"><div className="relative"><img src={user.avatar} className="w-10 h-10 rounded-full object-cover" /><span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${STATUS_CONFIG[user.status].color}`}></span></div><div><h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">{user.name} {user.role === 'visitor' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">Visitante</span>}</h4><p className="text-slate-500 text-xs">{user.jobTitle || sectorName} {roomName && `• Em: ${roomName}`}</p></div></div>
        <div className="flex gap-1">
            <button onClick={onOpenChat} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><MessageSquare size={16}/></button>
            <button onClick={onKnock} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Hand size={16}/></button>
            <button onClick={onStartCall} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><Video size={16}/></button>
        </div>
    </div>
);

const CreateGroupModal: React.FC<{ users: User[]; onClose: () => void; onCreate: (name: string, userIds: string[]) => void; }> = ({ users, onClose, onCreate }) => { const [name, setName] = useState(''); const [selected, setSelected] = useState<string[]>([]); const toggleUser = (id: string) => { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }; return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[80vh]"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800">Novo Espaço (Grupo)</h3><button onClick={onClose}><X size={20} className="text-slate-400" /></button></div><input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do grupo..." className="w-full px-3 py-2 border border-slate-300 rounded-xl mb-4" /><div className="flex-1 overflow-y-auto space-y-2 mb-4">{users.map(u => (<button key={u.id} onClick={() => toggleUser(u.id)} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left border ${selected.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-slate-50'}`}><img src={u.avatar} className="w-8 h-8 rounded-full" /><span className="font-semibold text-sm text-slate-700 flex-1">{u.name}</span>{selected.includes(u.id) && <Check size={16} className="text-indigo-600" />}</button>))}</div><button onClick={() => onCreate(name, selected)} disabled={!name || selected.length === 0} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">Criar Espaço</button></div></div>) }
const AddPeopleModal: React.FC<{ users: User[]; onClose: () => void; onAdd: (userIds: string[]) => void; }> = ({ users, onClose, onAdd }) => { const [selected, setSelected] = useState<string[]>([]); const toggleUser = (id: string) => { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }; return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[80vh]"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800">Adicionar Pessoas</h3><button onClick={onClose}><X size={20} className="text-slate-400" /></button></div>{users.length === 0 ? <p className="text-slate-500 text-center py-4">Todos já estão no grupo.</p> : (<div className="flex-1 overflow-y-auto space-y-2 mb-4">{users.map(u => (<button key={u.id} onClick={() => toggleUser(u.id)} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left border ${selected.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-slate-50'}`}><img src={u.avatar} className="w-8 h-8 rounded-full" /><span className="font-semibold text-sm text-slate-700 flex-1">{u.name}</span>{selected.includes(u.id) && <Check size={16} className="text-indigo-600" />}</button>))}</div>)}<button onClick={() => onAdd(selected)} disabled={selected.length === 0} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">Adicionar</button></div></div>) }
const ComposeAnnouncementModal: React.FC<{ users: User[]; onClose: () => void; onSend: (data: Partial<Announcement>) => void; }> = ({ users, onClose, onSend }) => { const [title, setTitle] = useState(''); const [message, setMessage] = useState(''); return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"><div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Megaphone className="text-amber-500" /> Novo Comunicado</h3><button onClick={onClose}><X size={20} className="text-slate-400" /></button></div><div className="space-y-4"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do anúncio..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /><textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Escreva sua mensagem aqui..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl h-32 resize-none" /><button onClick={() => onSend({ title, message })} disabled={!title || !message} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">Publicar</button></div></div></div>) }
const AnnouncementOverlay: React.FC<{ announcement: Announcement; onClose: () => void; }> = ({ announcement, onClose }) => { return (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in-95 duration-300"><div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative"><div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center relative"><Megaphone size={64} className="text-white/20 absolute" /><button onClick={onClose} className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition-colors"><X size={20}/></button></div><div className="p-8 text-center"><h2 className="text-2xl font-bold text-slate-800 mb-4">{announcement.title}</h2><p className="text-slate-600 leading-relaxed text-lg mb-8">{announcement.message}</p><button onClick={onClose} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Entendido</button></div></div></div>) }
const TaskModal: React.FC<{ task: Task | null, users: User[], currentUser: User, onClose: () => void, onSave: (t: Partial<Task>) => void, onComment: (id: string, text: string) => void }> = ({ task, users, currentUser, onClose, onSave, onComment }) => { const [title, setTitle] = useState(task?.title || ''); const [description, setDescription] = useState(task?.description || ''); const [status, setStatus] = useState<TaskStatus>(task?.status || 'todo'); const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'medium'); const [assigneeId, setAssigneeId] = useState(task?.assigneeId || currentUser.id); const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate.getTime() - (task.dueDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''); const [tagsInput, setTagsInput] = useState(task?.tags.join(', ') || ''); const [commentText, setCommentText] = useState(''); const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details'); const [attachments, setAttachments] = useState<TaskAttachment[]>(task?.attachments || []); const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const newFiles = Array.from(e.target.files).map(f => ({ id: `file-${Date.now()}-${Math.random()}`, name: f.name, url: URL.createObjectURL(f), type: f.type, size: f.size })); setAttachments([...attachments, ...newFiles]); } }; const handleSave = () => { onSave({ title, description, status, priority, assigneeId, dueDate: dueDate ? new Date(dueDate) : undefined, tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean), attachments }); }; const handleSendComment = () => { if (commentText.trim() && task) { onComment(task.id, commentText); setCommentText(''); } }; const isOverdue = task?.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done'; return (<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-fade-in-up flex flex-col h-[85vh]"><div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl shrink-0"><div className="flex items-center gap-3"><div className="bg-blue-600 text-white p-2 rounded-lg"><ClipboardList size={20} /></div><div><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">{task ? 'Detalhes da Tarefa' : 'Nova Tarefa'} {isOverdue && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full border border-red-200 flex items-center gap-1"><AlertCircle size={10}/> Atrasado</span>}</h3>{task && <p className="text-xs text-slate-500">Criado em {task.createdAt.toLocaleDateString()} por {users.find(u => u.id === task.creatorId)?.name || 'Desconhecido'}</p>}</div></div><button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button></div><div className="flex border-b border-slate-200 px-6 shrink-0 bg-white gap-6"><button onClick={() => setActiveTab('details')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><FileText size={16}/> Detalhes</button>{task && (<button onClick={() => setActiveTab('comments')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'comments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><MessageSquare size={16}/> Comentários <span className={`px-1.5 rounded-full text-xs ${activeTab === 'comments' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{task.comments.length}</span></button>)}{task && (<button onClick={() => setActiveTab('history')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><History size={16}/> Histórico</button>)}</div><div className="flex-1 overflow-y-auto p-8 bg-white">{activeTab === 'details' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-2 space-y-6"><div><label className="block text-sm font-bold text-slate-700 mb-1">Título</label><input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all font-bold text-lg text-slate-800 placeholder-slate-400" value={title} onChange={e => setTitle(e.target.value)} placeholder="O que precisa ser feito?" /></div><div><label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label><textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all min-h-[150px] text-slate-700 placeholder-slate-400" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da tarefa..." /></div><div><label className="block text-sm font-bold text-slate-700 mb-2">Anexos</label><div className="flex flex-wrap gap-3">{attachments.map(att => (<div key={att.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-700"><FileText size={16} className="text-slate-400" /><a href={att.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[150px] font-medium">{att.name}</a><button onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))} className="text-slate-400 hover:text-red-500 transition-colors"><X size={14}/></button></div>))}<label className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 border-dashed px-4 py-2 rounded-lg text-sm text-slate-600 font-medium cursor-pointer transition-all hover:border-slate-400"><Upload size={16} /> Adicionar Arquivo<input type="file" multiple className="hidden" onChange={handleFileUpload} /></label></div></div></div><div className="space-y-6"><div className="bg-slate-50 p-5 rounded-2xl space-y-5 border border-slate-200 shadow-sm"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Status</label><select className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>{Object.entries(TASK_STATUS_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.label}</option>))}</select></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Prioridade</label><select className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Responsável</label><select className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Prazo (Data e Hora)</label><input type="datetime-local" className={`w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none ${isOverdue ? 'border-red-300 text-red-600 bg-red-50' : ''}`} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tags (separar por vírgula)</label><input type="text" className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="dev, marketing..." value={tagsInput} onChange={e => setTagsInput(e.target.value)} /></div></div></div></div>)}{activeTab === 'comments' && task && (<div className="flex flex-col h-full"><div className="flex-1 space-y-4 overflow-y-auto pr-2 mb-4">{task.comments.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-slate-400"><MessageSquare size={32} className="mb-2 opacity-50"/><p>Nenhum comentário ainda.</p></div>}{task.comments.map(c => { const user = users.find(u => u.id === c.userId); return (<div key={c.id} className="flex gap-4 group"><img src={user?.avatar} className="w-10 h-10 rounded-full mt-1 border border-slate-200" /><div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-200 flex-1 hover:border-slate-300 transition-colors shadow-sm"><div className="flex justify-between items-baseline mb-2"><span className="font-bold text-slate-800 text-sm">{user?.name}</span><span className="text-xs text-slate-400">{c.createdAt.toLocaleString()}</span></div><p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.text}</p></div></div>) })}</div><div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-auto shadow-inner"><textarea className="w-full bg-transparent text-sm focus:outline-none min-h-[80px] placeholder-slate-400 text-slate-700 resize-none" placeholder="Escreva um comentário... (Use @ para mencionar)" value={commentText} onChange={e => setCommentText(e.target.value)}></textarea><div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200"><span className="text-xs text-slate-400 font-medium">Mencione @Nome para notificar</span><button onClick={handleSendComment} disabled={!commentText.trim()} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">Enviar</button></div></div></div>)}{activeTab === 'history' && task && (<div className="space-y-0">{task.history.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()).map((h, i) => { const user = users.find(u => u.id === h.userId); return (<div key={h.id} className="flex gap-4 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors"><div className="flex flex-col items-center"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200"><History size={14}/></div>{i !== task.history.length - 1 && <div className="w-px h-full bg-slate-200 my-1"></div>}</div><div className="text-sm pt-1"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-800">{user?.name}</span><span className="text-xs text-slate-400">{h.timestamp.toLocaleString()}</span></div><p className="text-slate-600">{h.action}</p></div></div>) })}</div>)}</div><div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50 rounded-b-3xl"><button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button><button onClick={handleSave} className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"><Check size={18} /> Salvar Tarefa</button></div></div></div>); };
