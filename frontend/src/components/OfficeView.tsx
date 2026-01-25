
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
import { uploadApi, tasksApi, sectorsApi, authApi, channelsApi } from '../api/client';

interface OfficeViewProps {
  office: Office;
  currentUser: User;
  onLogout: () => void;
  onStartCall: (target: User) => void;
  onEnterRoom: (room: Room) => void;
  onUpdateStatus: (status: UserStatus, message?: string) => void;
  onKnock: (target: User) => void;
  onCreateRoom: (roomData: { name: string, color: string, image: string, type: 'fixed', icon: string }) => void;
  onDeleteRoom: (roomId: string) => void;
  // New props for Settings
  onUpdateOffice: (data: Partial<Office>) => void;
  onUpdateUser: (user: User) => void;
  onCreateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onCreateInvite: (durationInMinutes: number) => VisitorInvite;
  // Sector management
  onCreateSector?: (sectorData: { name: string; color: string }) => Promise<void>;
  onUpdateSector?: (sectorId: string, sectorData: { name: string; color: string }) => Promise<void>;
  onDeleteSector?: (sectorId: string) => Promise<void>;
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

// NOVO: Helper function para gerar avatar com fallback para avatar padrão
const getUserAvatar = (user: User): string => {
    return user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`;
};

export const OfficeView: React.FC<OfficeViewProps> = ({
  office, currentUser, onLogout, onStartCall, onEnterRoom, onUpdateStatus, onKnock, onCreateRoom, onDeleteRoom,
  onUpdateOffice, onUpdateUser, onCreateUser, onDeleteUser, onCreateInvite,
  onCreateSector, onUpdateSector, onDeleteSector
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
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{x: number, y: number} | null>(null);

  // Modals
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [showAddPeopleModal, setShowAddPeopleModal] = useState(false); 
  
  // Settings & Profile
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // --- Notification State ---
  const [hasNotifications, setHasNotifications] = useState(false);

  // --- Call State ---
  const [outgoingCall, setOutgoingCall] = useState<{ targetUser: User; type: 'audio' | 'video' } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ caller: User; type: 'audio' | 'video' } | null>(null);
  const [usersInCall, setUsersInCall] = useState<{ [userId: string]: string[] }>({}); // userId -> array of user IDs they're in call with

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
      // Filtrar apenas por busca de nome - NÃO filtrar por setor aqui
      const matchesSearch = searchQuery === '' || u.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [office.users, searchQuery]);

  const usersBySector = useMemo(() => {
    const grouped: Record<string, User[]> = {};
    office.sectors.forEach(s => grouped[s.id] = []);
    filteredUsers.forEach(u => {
      if (u.sectorId && grouped[u.sectorId]) grouped[u.sectorId].push(u);
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

  const handleCreateGroup = async (name: string, selectedUsers: string[]) => {
      try {
          // Call backend API to create group channel
          const response = await channelsApi.create('group', selectedUsers, name);
          const newChannel = response.data;

          // Add to local state
          setChannels(prev => [...prev, {
              id: newChannel.id,
              type: 'group',
              name: newChannel.name,
              participants: newChannel.participants,
              messages: [],
              unreadCount: 0,
              lastMessageAt: new Date(newChannel.createdAt)
          }]);
          setActiveChannelId(newChannel.id);
          setShowCreateGroupModal(false);
      } catch (error) {
          console.error('Error creating group channel:', error);
          alert('Erro ao criar espaço. Tente novamente.');
      }
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

  const handleMouseDown = (e: React.MouseEvent, task: Task) => {
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTask || draggedTask.status === targetStatus) {
      setDraggedTask(null);
      setIsDragging(false);
      setDragStartPos(null);
      return;
    }

    try {
      // Atualizar via API
      await tasksApi.update(draggedTask.id, { status: targetStatus });

      // Atualizar estado local
      setTasks(prev => prev.map(t =>
        t.id === draggedTask.id
          ? { ...t, status: targetStatus, history: [...t.history, {
              id: `h-${Date.now()}`,
              userId: currentUser.id,
              action: `Alterou status para ${TASK_STATUS_CONFIG[targetStatus].label}`,
              timestamp: new Date()
            }]}
          : t
      ));

      setDraggedTask(null);
      setIsDragging(false);
      setDragStartPos(null);
    } catch (error) {
      console.error('Erro ao atualizar status da tarefa:', error);
      setDraggedTask(null);
      setIsDragging(false);
      setDragStartPos(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setIsDragging(false);
    setDragStartPos(null);
  };

  const handleTaskComment = async (taskId: string, text: string, mentions?: string[]) => {
      try {
          // Chamar a API para adicionar o comentário com menções
          await tasksApi.addComment(taskId, text, mentions);

          // Criar notificações locais para usuários mencionados
          if (mentions && mentions.length > 0) {
              mentions.forEach(userId => {
                  if (userId !== currentUser.id) {
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

          // Atualizar o estado local com o novo comentário
          const newComment: TaskComment = {
              id: `c-${Date.now()}`,
              userId: currentUser.id,
              text,
              createdAt: new Date(),
              mentions: mentions || []
          };

          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: [...t.comments, newComment] } : t));
      } catch (error) {
          console.error('Erro ao adicionar comentário:', error);
          setLocalNotifications(prev => [{
              id: `notif-${Date.now()}`,
              text: 'Erro ao adicionar comentário. Tente novamente.',
              type: 'task',
              referenceId: taskId
          }, ...prev]);
          setHasNotifications(true);
      }
  };

  const handleDeleteTask = async (taskId: string) => {
      try {
          await tasksApi.delete(taskId);
          setTasks(prev => prev.filter(t => t.id !== taskId));
          setShowTaskModal(false);
          setEditingTask(null);
          setLocalNotifications(prev => [{
              id: `notif-${Date.now()}`,
              text: 'Tarefa deletada com sucesso!',
              type: 'task',
              referenceId: taskId
          }, ...prev]);
          setHasNotifications(true);
      } catch (error) {
          console.error('Erro ao deletar tarefa:', error);
          setLocalNotifications(prev => [{
              id: `notif-${Date.now()}`,
              text: 'Erro ao deletar tarefa. Tente novamente.',
              type: 'task',
              referenceId: taskId
          }, ...prev]);
          setHasNotifications(true);
      }
  };

  const handleTaskClick = (e: React.MouseEvent, task: Task) => {
      // Não abrir modal se estiver fazendo ou acabou de fazer drag
      if (isDragging) {
        return;
      }

      setEditingTask(task);
      setShowTaskModal(true);
      setDragStartPos(null);
  };

  const handleTaskMouseUp = (e: React.MouseEvent, task: Task) => {
      // Só abre se não está arrastando e não arrastou
      if (!isDragging && dragStartPos) {
        const moved = Math.abs(e.clientX - dragStartPos.x) > 5 || Math.abs(e.clientY - dragStartPos.y) > 5;
        if (!moved) {
          setEditingTask(task);
          setShowTaskModal(true);
        }
      }
      setDragStartPos(null);
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

  // --- Call Functions ---
  const handleInitiateCall = (targetUser: User, type: 'audio' | 'video' = 'video') => {
      setOutgoingCall({ targetUser, type });
      // Emit WebSocket event - will be handled by parent component
      // For now, just show the modal
  };

  const handleAcceptCall = () => {
      if (incomingCall) {
          // Add both users to call
          setUsersInCall(prev => ({
              ...prev,
              [currentUser.id]: [...(prev[currentUser.id] || []), incomingCall.caller.id],
              [incomingCall.caller.id]: [...(prev[incomingCall.caller.id] || []), currentUser.id]
          }));

          // Enter the call
          onStartCall(incomingCall.caller);
          setIncomingCall(null);
      }
  };

  const handleRejectCall = () => {
      setIncomingCall(null);
  };

  const handleCancelCall = () => {
      setOutgoingCall(null);
  };

  const handleEndCall = (otherUserId: string) => {
      setUsersInCall(prev => {
          const updated = { ...prev };
          updated[currentUser.id] = (updated[currentUser.id] || []).filter(id => id !== otherUserId);
          updated[otherUserId] = (updated[otherUserId] || []).filter(id => id !== currentUser.id);
          return updated;
      });
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
                    <img src={getUserAvatar(currentUser)} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" alt="Me" />
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

      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-200/20 via-purple-200/10 to-transparent pointer-events-none"></div>
        <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-white/60 px-6 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-sm relative">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative w-full max-w-xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar pessoas, salas..."
                        className="w-full pl-11 pr-4 py-2.5 bg-white/80 backdrop-blur border border-indigo-200/50 rounded-xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white transition-all shadow-sm hover:shadow-md"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-lg shadow-lg">
                <Clock size={16} />
                <span className="font-semibold text-xs">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 scroll-smooth space-y-6 w-full">
            <section className="animate-fade-in-up">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-200/50 animate-pulse">
                            <Monitor className="text-white" size={16} />
                        </div>
                        <h3 className="text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Salas de Reunião
                        </h3>
                    </div>
                    {isAdmin && (
                        <button onClick={() => setShowCreateRoomModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-bold hover:shadow-lg hover:scale-105 transition-all shadow-md">
                            <Plus size={12} /> Nova
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2">
                    {office.rooms.map(room => {
                        const IconComponent = room.icon && ROOM_ICONS[room.icon] ? ROOM_ICONS[room.icon] : ROOM_ICONS['default'];
                        return (
                            <div key={room.id} className="rounded-lg p-2 border border-slate-200/40 hover:border-indigo-400/60 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group bg-white/80 backdrop-blur-md" style={{ background: room.backgroundImage ? `linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), url(${room.backgroundImage})` : 'linear-gradient(to bottom right, white, rgba(255, 255, 255, 0.95))', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                                 <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" style={{ backgroundColor: room.color || '#6366f1' }}></div>
                                 <div className="absolute top-1 right-1 flex gap-1 z-10">
                                     {room.isRestricted && <div className="bg-white/90 backdrop-blur-sm px-1 py-0.5 rounded text-[8px] font-bold text-slate-500 flex items-center gap-0.5 shadow-sm"><Lock size={7} /></div>}
                                     {isAdmin && (
                                         <button onClick={(e) => { e.stopPropagation(); onDeleteRoom(room.id); }} className="bg-white/90 backdrop-blur-sm p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={8} /></button>
                                     )}
                                 </div>
                                 <div className="relative z-10">
                                     <div className="flex items-center justify-center mb-1.5">
                                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300`} style={{ background: `linear-gradient(135deg, ${room.color || '#6366f1'}, ${room.color || '#6366f1'}dd)` }}>{room.participants.length > 0 ? <Users size={14} /> : <IconComponent size={14} />}</div>
                                     </div>
                                     <h3 className="text-[11px] font-bold text-slate-800 text-center mb-1 group-hover:text-indigo-600 transition-colors truncate">{room.name}</h3>
                                     <div className="flex items-center justify-center gap-1 mb-1.5">
                                        {room.participants.length > 0 ? (
                                            <span className="text-[9px] bg-gradient-to-r from-green-500 to-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 animate-pulse">
                                                <Users size={8} /> {room.participants.length}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] text-slate-400 italic">Vazia</span>
                                        )}
                                     </div>
                                     <button onClick={() => onEnterRoom(room)} disabled={room.isRestricted && room.participants.length === 0} className="w-full py-1 rounded-md text-white text-[9px] font-bold hover:shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: room.participants.length > 0 ? `linear-gradient(135deg, ${room.color || '#6366f1'}, ${room.color || '#6366f1'}dd)` : '#cbd5e1' }}>
                                        {room.participants.length > 0 ? 'Entrar' : 'Vazia'}
                                     </button>
                                 </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="animate-fade-in-up animation-delay-200 pb-12">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-200/50 animate-pulse">
                            <Users className="text-white" size={16} />
                        </div>
                        <h3 className="text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                            Colaboradores
                            <span className="text-[10px] font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-2 py-0.5 rounded-full shadow-md">{office.users.length}</span>
                        </h3>
                    </div>
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-2 flex-wrap mb-4">
                    <button
                        onClick={() => setSelectedSector('all')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                            selectedSector === 'all'
                                ? 'bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-lg shadow-slate-300 scale-105'
                                : 'bg-white/80 backdrop-blur border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md'
                        }`}
                    >
                        Todos <span className={`ml-1 ${selectedSector === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>({office.users.length})</span>
                    </button>

                    {office.sectors.map(sector => {
                        const sectorUsers = office.users.filter(u => u.sectorId === sector.id);
                        const onlineCount = sectorUsers.filter(u => u.status !== 'offline').length;

                        return (
                            <button
                                key={sector.id}
                                onClick={() => setSelectedSector(sector.id)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                                    selectedSector === sector.id
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-300 scale-105'
                                        : 'bg-white/80 backdrop-blur border border-slate-200 text-slate-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-200 hover:shadow-md'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${sector.color} ${selectedSector === sector.id ? 'animate-pulse' : ''}`}></span>
                                {sector.name} <span className={selectedSector === sector.id ? 'text-indigo-200' : 'text-slate-400'}>({sectorUsers.length})</span>
                                {onlineCount > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${selectedSector === sector.id ? 'bg-emerald-400 text-emerald-900' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {onlineCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Listagem de colaboradores - sempre visíveis, segmentados por setor */}
                <div className="space-y-6">
                    {office.sectors.map((sector) => {
                        const sectorUsers = filteredUsers.filter(u => u.sectorId === sector.id);
                        if (sectorUsers.length === 0) return null;

                            const onlineCount = sectorUsers.filter(u => u.status !== 'offline').length;

                            return (
                                <div key={sector.id}>
                                    {/* Divisor de setor */}
                                    <div className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-200/50">
                                        <div className={`w-3 h-3 rounded-full ${sector.color} shadow-md animate-pulse`}></div>
                                        <h4 className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{sector.name}</h4>
                                        <span className="text-[10px] font-bold bg-white/80 backdrop-blur text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                                            {sectorUsers.length}
                                        </span>
                                        {onlineCount > 0 && (
                                            <span className="text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                                                <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>
                                                {onlineCount}
                                            </span>
                                        )}
                                    </div>

                                    {/* Grid de usuários do setor */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5 mb-5">
                                        {sectorUsers.map(user => {
                                            const roomName = user.currentRoomId ? office.rooms.find(r => r.id === user.currentRoomId)?.name : undefined;
                                            const isCurrentUser = user.id === currentUser.id;
                                            const isBusy = user.status === 'busy' || user.status === 'in_meeting';

                                            return (
                                                <div key={user.id} className="relative bg-white/80 backdrop-blur-md rounded-lg border border-slate-200/40 p-2 shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-indigo-400/60 transition-all duration-300 group overflow-hidden">
                                                    <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                                                    <div className="relative z-10">
                                                        <div className="flex items-start gap-1.5 mb-2">
                                                            <div className="relative">
                                                                <div className={`absolute inset-0 rounded-full ${STATUS_CONFIG[user.status].ring} ring-1 animate-pulse`}></div>
                                                                <img
                                                                    src={getUserAvatar(user)}
                                                                    alt={user.name}
                                                                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-lg relative group-hover:scale-110 transition-transform duration-300"
                                                                />
                                                                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${STATUS_CONFIG[user.status].color} shadow-sm`}></span>
                                                                {usersInCall[user.id] && usersInCall[user.id].length > 0 && (
                                                                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-white rounded-full flex items-center justify-center animate-pulse shadow-lg">
                                                                        <Phone size={8} className="text-white" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-slate-800 text-[11px] truncate flex items-center gap-0.5">
                                                                    {user.name}
                                                                    {isCurrentUser && <span className="text-[8px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1 py-0.5 rounded font-bold">Você</span>}
                                                                </h4>
                                                                <p className="text-[9px] text-slate-500 truncate">{user.jobTitle || sector.name}</p>
                                                                <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                                                                    <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${STATUS_CONFIG[user.status].color.replace('bg-', 'bg-').replace('-500', '-100')} ${STATUS_CONFIG[user.status].color.replace('bg-', 'text-').replace('-500', '-700')}`}>
                                                                        {STATUS_CONFIG[user.status].label}
                                                                    </span>
                                                                    {roomName && (
                                                                        <span className="text-[8px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded flex items-center gap-0.5">
                                                                            <Monitor size={7} /> {roomName}
                                                                        </span>
                                                                    )}
                                                                    {usersInCall[user.id] && usersInCall[user.id].length > 0 && (
                                                                        <span className="text-[8px] bg-green-100 text-green-700 px-1 py-0.5 rounded flex items-center gap-0.5 font-semibold animate-pulse">
                                                                            <Phone size={7} /> Chamada
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {user.statusMessage && (
                                                            <p className="text-[9px] text-slate-500 italic mb-1.5 px-1 py-0.5 bg-slate-50/80 rounded line-clamp-1">
                                                                "{user.statusMessage}"
                                                            </p>
                                                        )}

                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => handleOpenChatWithUser(user)}
                                                                className="p-1.5 rounded-md bg-slate-100/80 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 transition-all shadow-sm hover:shadow-md hover:scale-110"
                                                                title="Enviar mensagem"
                                                            >
                                                                <MessageSquare size={12}/>
                                                            </button>
                                                            {!isCurrentUser && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleInitiateCall(user, 'audio')}
                                                                        className="p-1.5 rounded-md bg-slate-100/80 text-slate-600 hover:bg-green-100 hover:text-green-600 transition-all shadow-sm hover:shadow-md hover:scale-110"
                                                                        title="Ligar para o colaborador"
                                                                    >
                                                                        <Phone size={12}/>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleInitiateCall(user, 'video')}
                                                                        className="flex-1 py-1.5 px-2 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center gap-1 font-bold text-[10px] shadow-md hover:shadow-lg hover:scale-105"
                                                                        title="Chamada de vídeo"
                                                                    >
                                                                        <Video size={12}/> Ligar
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                    {/* Usuários sem setor atribuído */}
                    {(() => {
                        const usersWithoutSector = filteredUsers.filter(u => !u.sectorId || !office.sectors.find(s => s.id === u.sectorId));
                        if (usersWithoutSector.length === 0) return null;

                        return (
                            <div>
                                <div className="flex items-center gap-4 mb-6 pb-3 border-b-2 border-gradient-to-r from-slate-200 via-slate-300 to-slate-200">
                                    <div className="w-4 h-4 rounded-full bg-slate-400 shadow-lg"></div>
                                    <h4 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Sem Setor</h4>
                                    <span className="text-xs font-bold bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 px-3 py-1 rounded-full border border-slate-300 shadow-sm">
                                        {usersWithoutSector.length} {usersWithoutSector.length === 1 ? 'colaborador' : 'colaboradores'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5 mb-5">
                                    {usersWithoutSector.map(user => {
                                        const roomName = user.currentRoomId ? office.rooms.find(r => r.id === user.currentRoomId)?.name : undefined;
                                        const isCurrentUser = user.id === currentUser.id;
                                        const isBusy = user.status === 'busy' || user.status === 'in_meeting';

                                        return (
                                            <div key={user.id} className="relative bg-white/80 backdrop-blur-md rounded-lg border border-slate-200/40 p-2 shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-indigo-400/60 transition-all duration-300 group overflow-hidden">
                                                <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                                                <div className="relative z-10">
                                                    <div className="flex items-start gap-1.5 mb-2">
                                                        <div className="relative">
                                                            <div className={`absolute inset-0 rounded-full ${STATUS_CONFIG[user.status].ring} ring-1 animate-pulse`}></div>
                                                            <img
                                                                src={getUserAvatar(user)}
                                                                alt={user.name}
                                                                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-lg relative group-hover:scale-110 transition-transform duration-300"
                                                            />
                                                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${STATUS_CONFIG[user.status].color} shadow-sm`}></span>
                                                            {usersInCall[user.id] && usersInCall[user.id].length > 0 && (
                                                                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-white rounded-full flex items-center justify-center animate-pulse shadow-lg">
                                                                    <Phone size={8} className="text-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-slate-800 text-[11px] truncate flex items-center gap-0.5">
                                                                {user.name}
                                                                {isCurrentUser && <span className="text-[8px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1 py-0.5 rounded font-bold">Você</span>}
                                                            </h4>
                                                            <p className="text-[9px] text-slate-500 truncate">{user.jobTitle || 'Sem setor'}</p>
                                                            <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                                                                <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${STATUS_CONFIG[user.status].color.replace('bg-', 'bg-').replace('-500', '-100')} ${STATUS_CONFIG[user.status].color.replace('bg-', 'text-').replace('-500', '-700')}`}>
                                                                    {STATUS_CONFIG[user.status].label}
                                                                </span>
                                                                {roomName && (
                                                                    <span className="text-[8px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded flex items-center gap-0.5">
                                                                        <Monitor size={7} /> {roomName}
                                                                    </span>
                                                                )}
                                                                {usersInCall[user.id] && usersInCall[user.id].length > 0 && (
                                                                    <span className="text-[8px] bg-green-100 text-green-700 px-1 py-0.5 rounded flex items-center gap-0.5 font-semibold animate-pulse">
                                                                        <Phone size={7} /> Chamada
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {user.statusMessage && (
                                                        <p className="text-[9px] text-slate-500 italic mb-1.5 px-1 py-0.5 bg-slate-50/80 rounded line-clamp-1">
                                                            "{user.statusMessage}"
                                                        </p>
                                                    )}

                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleOpenChatWithUser(user)}
                                                            className="p-1.5 rounded-md bg-slate-100/80 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 transition-all shadow-sm hover:shadow-md hover:scale-110"
                                                            title="Enviar mensagem"
                                                        >
                                                            <MessageSquare size={12}/>
                                                        </button>
                                                        {!isCurrentUser && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleInitiateCall(user, 'audio')}
                                                                    className="p-1.5 rounded-md bg-slate-100/80 text-slate-600 hover:bg-green-100 hover:text-green-600 transition-all shadow-sm hover:shadow-md hover:scale-110"
                                                                    title="Ligar para o colaborador"
                                                                >
                                                                    <Phone size={12}/>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleInitiateCall(user, 'video')}
                                                                    className="flex-1 py-1.5 px-2 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center gap-1 font-bold text-[10px] shadow-md hover:shadow-lg hover:scale-105"
                                                                    title="Chamada de vídeo"
                                                                >
                                                                    <Video size={12}/> Ligar
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Mensagem se não houver usuários */}
                    {filteredUsers.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Users size={48} className="mb-4 opacity-20" />
                            <p>Nenhum colaborador encontrado</p>
                        </div>
                    )}

                    {/* Debug: mostrar se há usuários mas não estão aparecendo */}
                    {filteredUsers.length > 0 && office.sectors.filter(s => selectedSector === 'all' || s.id === selectedSector).every(sector => {
                        const sectorUsers = filteredUsers.filter(u => u.sectorId === sector.id);
                        return sectorUsers.length === 0;
                    }) && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Users size={48} className="mb-4 opacity-20" />
                            <p>Usuários encontrados mas sem setor atribuído</p>
                            <p className="text-xs mt-2">Total de usuários: {filteredUsers.length}</p>
                        </div>
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
                                                <div className="relative"><img src={getUserAvatar(otherUser)} className="w-8 h-8 rounded-full object-cover" /><span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${STATUS_CONFIG[otherUser.status].color}`}></span></div>
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
                                                    {!isMe && showHeader ? (<img src={sender ? getUserAvatar(sender) : getUserAvatar({ name: "Unknown", avatar: "" } as User)} className="w-8 h-8 rounded-full object-cover mt-1" />) : (!isMe ? <div className="w-8" /> : null)}
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
                                                <button key={u.id} onClick={() => insertMention(u)} className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2 text-sm"><img src={getUserAvatar(u)} className="w-6 h-6 rounded-full" /><span className="text-slate-700 font-medium">{u.name}</span></button>
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
                                                 <tr key={task.id} onClick={(e) => handleTaskClick(e, task)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
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
                                                                 <img src={getUserAvatar(assignee)} className="w-6 h-6 rounded-full" />
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
                                         <div className="p-3 space-y-3 overflow-y-auto flex-1 bg-slate-100/50" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                                             {tasks.filter(t => t.status === status).map(task => {
                                                  const assignee = office.users.find(u => u.id === task.assigneeId);
                                                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
                                                  return (
                                                     <div key={task.id} onMouseDown={(e) => handleMouseDown(e, task)} onClick={(e) => handleTaskClick(e, task)} className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 cursor-move transition-all group ${draggedTask?.id === task.id ? 'opacity-50 cursor-grabbing' : 'cursor-grab'}`} draggable={true} onDragStart={(e) => handleDragStart(e, task)} onDragEnd={handleDragEnd}>
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
                                                                     <img src={getUserAvatar(assignee)} className="w-6 h-6 rounded-full border border-slate-100" title={assignee.name} />
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
                                                         <div key={t.id} onClick={(e) => handleTaskClick(e, t)} className={`text-[10px] truncate px-1.5 py-1 rounded cursor-pointer border ${TASK_STATUS_CONFIG[t.status].bg} ${TASK_STATUS_CONFIG[t.status].color} ${TASK_STATUS_CONFIG[t.status].border} font-bold shadow-sm`}>
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
              onDelete={handleDeleteTask}
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
                             <img src={getUserAvatar(u)} className="w-10 h-10 rounded-full" />
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
              onCreateSector={onCreateSector}
              onUpdateSector={onUpdateSector}
              onDeleteSector={onDeleteSector}
          />
      )}

      {showEditProfileModal && (
          <EditProfileModal
              user={currentUser}
              onClose={() => setShowEditProfileModal(false)}
              onUpdate={onUpdateUser}
          />
      )}

      {/* Outgoing Call Modal */}
      {outgoingCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-fade-in-up text-center">
                  <div className="mb-6">
                      <img src={getUserAvatar(outgoingCall.targetUser)} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-indigo-100" />
                      <h3 className="text-xl font-bold text-slate-800 mb-1">{outgoingCall.targetUser.name}</h3>
                      <p className="text-slate-500 text-sm">Chamando...</p>
                  </div>
                  <div className="flex items-center justify-center mb-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center animate-pulse">
                          {outgoingCall.type === 'video' ? <Video size={32} className="text-white" /> : <Phone size={32} className="text-white" />}
                      </div>
                  </div>
                  <button
                      onClick={handleCancelCall}
                      className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors"
                  >
                      Cancelar
                  </button>
              </div>
          </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-fade-in-up text-center">
                  <div className="mb-6">
                      <img src={getUserAvatar(incomingCall.caller)} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-green-100 animate-bounce" />
                      <h3 className="text-xl font-bold text-slate-800 mb-1">{incomingCall.caller.name}</h3>
                      <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                          {incomingCall.type === 'video' ? <Video size={16} /> : <Phone size={16} />}
                          Chamada de {incomingCall.type === 'video' ? 'vídeo' : 'áudio'} recebida
                      </p>
                  </div>
                  <div className="flex gap-3">
                      <button
                          onClick={handleRejectCall}
                          className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                          <X size={20} /> Recusar
                      </button>
                      <button
                          onClick={handleAcceptCall}
                          className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                          <Phone size={20} /> Aceitar
                      </button>
                  </div>
              </div>
          </div>
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
    onCreateSector?: (sectorData: { name: string; color: string }) => Promise<void>;
    onUpdateSector?: (sectorId: string, sectorData: { name: string; color: string }) => Promise<void>;
    onDeleteSector?: (sectorId: string) => Promise<void>;
}> = ({ office, onClose, onUpdateOffice, onUpdateUser, onCreateUser, onDeleteUser, onCreateInvite, onCreateSector, onUpdateSector, onDeleteSector }) => {
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

    // Sector Management State
    const [showSectorModal, setShowSectorModal] = useState(false);
    const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
    const [sectorFormData, setSectorFormData] = useState({ name: '', color: '#3b82f6' });

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

    const handleSaveSector = async () => {
        if (!sectorFormData.name) {
            alert('Digite o nome do setor');
            return;
        }

        try {
            if (editingSectorId) {
                if (onUpdateSector) {
                    await onUpdateSector(editingSectorId, sectorFormData);
                } else {
                    await sectorsApi.update(editingSectorId, sectorFormData);
                }
            } else {
                if (onCreateSector) {
                    await onCreateSector(sectorFormData);
                } else {
                    await sectorsApi.create(sectorFormData);
                }
            }

            setShowSectorModal(false);
            setEditingSectorId(null);
            setSectorFormData({ name: '', color: '#3b82f6' });
        } catch (error) {
            console.error('Erro ao salvar setor:', error);
            alert('Erro ao salvar setor. Tente novamente.');
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
                                        const sectorName = office.sectors.find(s => s.id === u.sectorId)?.name || 'Sem Setor';
                                        return (
                                            <div key={u.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <img src={getUserAvatar(u)} className="w-12 h-12 rounded-full object-cover border border-slate-100" />
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
                                        <button
                                          onClick={() => {
                                            setEditingSectorId(s.id);
                                            setSectorFormData({ name: s.name, color: s.color });
                                            setShowSectorModal(true);
                                          }}
                                          className="text-xs text-indigo-600 font-bold hover:underline"
                                        >
                                          Editar
                                        </button>
                                    </div>
                                ))}
                                <button
                                  onClick={() => {
                                    setEditingSectorId(null);
                                    setSectorFormData({ name: '', color: '#3b82f6' });
                                    setShowSectorModal(true);
                                  }}
                                  className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-slate-400"
                                >
                                  + Adicionar Setor
                                </button>
                             </div>
                        )}
                    </div>
                </div>
            </div>

            {showSectorModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">{editingSectorId ? 'Editar Setor' : 'Novo Setor'}</h3>
                            <button onClick={() => setShowSectorModal(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Setor</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-xl bg-white text-black"
                                    value={sectorFormData.name}
                                    onChange={(e) => setSectorFormData({...sectorFormData, name: e.target.value})}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Cor</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        className="h-10 w-10 border-0 rounded cursor-pointer"
                                        value={sectorFormData.color}
                                        onChange={(e) => setSectorFormData({...sectorFormData, color: e.target.value})}
                                    />
                                    <input
                                        type="text"
                                        className="w-32 px-4 py-2 border border-slate-300 rounded-xl uppercase bg-white text-black"
                                        value={sectorFormData.color}
                                        onChange={(e) => setSectorFormData({...sectorFormData, color: e.target.value})}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleSaveSector}
                                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
                            >
                                {editingSectorId ? 'Salvar Alterações' : 'Criar Setor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // NOVO: Estados para alteração de senha
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione uma imagem.');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
        reader.readAsDataURL(file);

        // Upload file
        setUploading(true);
        try {
            const response = await uploadApi.avatar(file);
            setAvatar(response.data.url);
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Falha ao enviar imagem. Tente novamente.');
            setPreviewUrl(null);
        } finally {
            setUploading(false);
        }
    };

    // NOVO: Função para alterar senha
    const handleChangePassword = async () => {
        setPasswordError('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('Todos os campos de senha são obrigatórios');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Nova senha e confirmação não coincidem');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('Nova senha deve ter no mínimo 6 caracteres');
            return;
        }

        setChangingPassword(true);
        try {
            await authApi.changePassword(currentPassword, newPassword);
            alert('Senha alterada com sucesso!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error('Change password failed:', err);
            setPasswordError(err.response?.data?.message || 'Erro ao alterar senha. Verifique a senha atual.');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate({ ...user, name, avatar });
        onClose();
    };

    // MELHORIA: Fallback para avatar padrão se não houver foto
    const displayAvatar = previewUrl || avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Editar Perfil</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col items-center mb-4">
                        <div className="relative group">
                            <img
                                src={displayAvatar}
                                className={`w-24 h-24 rounded-full border-4 border-indigo-100 object-cover ${uploading ? 'opacity-50' : ''}`}
                                alt="Avatar"
                            />
                            {uploading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                disabled={uploading}
                            >
                                <Upload className="w-6 h-6 text-white" />
                            </button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                            disabled={uploading}
                        >
                            <Upload size={14} /> Alterar foto
                        </button>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-lg text-slate-800"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* NOVO: Seção de alteração de senha */}
                    <div className="border-t border-slate-200 pt-4 mt-4">
                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Lock size={16} /> Alterar Senha
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha Atual</label>
                                <input
                                    type="password"
                                    className="w-full p-2 border rounded-lg text-slate-800"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    placeholder="Digite sua senha atual"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Senha</label>
                                <input
                                    type="password"
                                    className="w-full p-2 border rounded-lg text-slate-800"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    className="w-full p-2 border rounded-lg text-slate-800"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Digite novamente"
                                />
                            </div>
                            {passwordError && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-2 rounded-lg">
                                    {passwordError}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={handleChangePassword}
                                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                                className="w-full py-2 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {changingPassword ? 'Alterando...' : 'Alterar Senha'}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                        <button type="submit" disabled={uploading} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CreateRoomModal: React.FC<{
    onClose: () => void;
    onCreate: (data: { name: string, color: string, image: string, type: 'fixed', icon: string }) => void;
}> = ({ onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('default');
    const handleCreate = () => { if(!name) return; onCreate({ name, type: 'fixed', icon, color: '#6366f1', image: `https://picsum.photos/seed/${name}/400/200` }); };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800">Nova Sala</h3><button onClick={onClose}><X size={20} className="text-slate-400" /></button></div>
                <div className="space-y-4">
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Nome da Sala</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800" autoFocus /></div>
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
        <div className="relative mb-3"><img src={getUserAvatar(user)} alt={user.name} className="w-20 h-20 rounded-full object-cover border-4 border-slate-50 shadow-sm" /><span className={`absolute bottom-1 right-1 w-4 h-4 border-2 border-white rounded-full ${STATUS_CONFIG[user.status].color}`}></span></div>
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
        <div className="flex items-center gap-3"><div className="relative"><img src={getUserAvatar(user)} className="w-10 h-10 rounded-full object-cover" /><span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${STATUS_CONFIG[user.status].color}`}></span></div><div><h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">{user.name} {user.role === 'visitor' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">Visitante</span>}</h4><p className="text-slate-500 text-xs">{user.jobTitle || sectorName} {roomName && `• Em: ${roomName}`}</p></div></div>
        <div className="flex gap-1">
            <button onClick={onOpenChat} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><MessageSquare size={16}/></button>
            <button onClick={onKnock} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Hand size={16}/></button>
            <button onClick={onStartCall} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><Video size={16}/></button>
        </div>
    </div>
);

const CreateGroupModal: React.FC<{ users: User[]; onClose: () => void; onCreate: (name: string, userIds: string[]) => void; }> = ({ users, onClose, onCreate }) => { const [name, setName] = useState(''); const [selected, setSelected] = useState<string[]>([]); const toggleUser = (id: string) => { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }; return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[80vh]"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800">Novo Espaço (Grupo)</h3><button onClick={onClose}><X size={20} className="text-slate-400" /></button></div><input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do grupo..." className="w-full px-3 py-2 border border-slate-300 rounded-xl mb-4" /><div className="flex-1 overflow-y-auto space-y-2 mb-4">{users.map(u => (<button key={u.id} onClick={() => toggleUser(u.id)} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left border ${selected.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-slate-50'}`}><img src={getUserAvatar(u)} className="w-8 h-8 rounded-full" /><span className="font-semibold text-sm text-slate-700 flex-1">{u.name}</span>{selected.includes(u.id) && <Check size={16} className="text-indigo-600" />}</button>))}</div><button onClick={() => onCreate(name, selected)} disabled={!name || selected.length === 0} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">Criar Espaço</button></div></div>) }
const AddPeopleModal: React.FC<{ users: User[]; onClose: () => void; onAdd: (userIds: string[]) => void; }> = ({ users, onClose, onAdd }) => { const [selected, setSelected] = useState<string[]>([]); const toggleUser = (id: string) => { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }; return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[80vh]"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800">Adicionar Pessoas</h3><button onClick={onClose}><X size={20} className="text-slate-400" /></button></div>{users.length === 0 ? <p className="text-slate-500 text-center py-4">Todos já estão no grupo.</p> : (<div className="flex-1 overflow-y-auto space-y-2 mb-4">{users.map(u => (<button key={u.id} onClick={() => toggleUser(u.id)} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left border ${selected.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-slate-50'}`}><img src={getUserAvatar(u)} className="w-8 h-8 rounded-full" /><span className="font-semibold text-sm text-slate-700 flex-1">{u.name}</span>{selected.includes(u.id) && <Check size={16} className="text-indigo-600" />}</button>))}</div>)}<button onClick={() => onAdd(selected)} disabled={selected.length === 0} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">Adicionar</button></div></div>) }
const ComposeAnnouncementModal: React.FC<{ users: User[]; onClose: () => void; onSend: (data: Partial<Announcement>) => void; }> = ({ users, onClose, onSend }) => { const [title, setTitle] = useState(''); const [message, setMessage] = useState(''); return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"><div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Megaphone className="text-amber-500" /> Novo Comunicado</h3><button onClick={onClose}><X size={20} className="text-slate-400" /></button></div><div className="space-y-4"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do anúncio..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /><textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Escreva sua mensagem aqui..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl h-32 resize-none" /><button onClick={() => onSend({ title, message })} disabled={!title || !message} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">Publicar</button></div></div></div>) }
const AnnouncementOverlay: React.FC<{ announcement: Announcement; onClose: () => void; }> = ({ announcement, onClose }) => { return (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in-95 duration-300"><div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative"><div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center relative"><Megaphone size={64} className="text-white/20 absolute" /><button onClick={onClose} className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition-colors"><X size={20}/></button></div><div className="p-8 text-center"><h2 className="text-2xl font-bold text-slate-800 mb-4">{announcement.title}</h2><p className="text-slate-600 leading-relaxed text-lg mb-8">{announcement.message}</p><button onClick={onClose} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Entendido</button></div></div></div>) }
const TaskModal: React.FC<{ task: Task | null, users: User[], currentUser: User, onClose: () => void, onSave: (t: Partial<Task>) => void, onComment: (id: string, text: string, mentions?: string[]) => void, onDelete?: (id: string) => void }> = ({ task, users, currentUser, onClose, onSave, onComment, onDelete }) => { const [title, setTitle] = useState(task?.title || ''); const [description, setDescription] = useState(task?.description || ''); const [status, setStatus] = useState<TaskStatus>(task?.status || 'todo'); const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'medium'); const [assigneeId, setAssigneeId] = useState(task?.assigneeId || currentUser.id); const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate.getTime() - (task.dueDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''); const [tagsInput, setTagsInput] = useState(task?.tags.join(', ') || ''); const [commentText, setCommentText] = useState(''); const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details'); const [attachments, setAttachments] = useState<TaskAttachment[]>(task?.attachments || []); const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const newFiles = Array.from(e.target.files).map(f => ({ id: `file-${Date.now()}-${Math.random()}`, name: f.name, url: URL.createObjectURL(f), type: f.type, size: f.size })); setAttachments([...attachments, ...newFiles]); } }; const handleSave = () => { onSave({ title, description, status, priority, assigneeId, dueDate: dueDate ? new Date(dueDate) : undefined, tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean), attachments }); }; const handleSendComment = () => { if (commentText.trim() && task) { // MELHORIA: Detectar menções no formato @NomeDoUsuário (agora suporta nomes compostos)
        // Regex melhorado: captura tudo entre @ e um espaço/quebra de linha/fim da string
        // Exemplos: "@João Silva" ou "@Maria" ou "@Pedro Santos 123"
        const mentionMatches = commentText.match(/@([^\s]+(?:\s+[^\s@]+)*?)(?=\s|$|@)/g);
        const mentionedUserIds: string[] = [];
        if (mentionMatches) {
            mentionMatches.forEach(match => {
                // Remove o @ do início
                const mentionedName = match.substring(1);
                // Procurar o usuário por nome (case-insensitive)
                const user = users.find(u => u.name.toLowerCase().includes(mentionedName.toLowerCase()));
                if (user) {
                    mentionedUserIds.push(user.id);
                }
            });
        }
        onComment(task.id, commentText, mentionedUserIds);
        setCommentText('');
    }
}; const isOverdue = task?.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done'; return (<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-fade-in-up flex flex-col h-[85vh]"><div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl shrink-0"><div className="flex items-center gap-3"><div className="bg-blue-600 text-white p-2 rounded-lg"><ClipboardList size={20} /></div><div><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">{task ? 'Detalhes da Tarefa' : 'Nova Tarefa'} {isOverdue && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full border border-red-200 flex items-center gap-1"><AlertCircle size={10}/> Atrasado</span>}</h3>{task && <p className="text-xs text-slate-500">Criado em {task.createdAt.toLocaleDateString()} por {users.find(u => u.id === task.creatorId)?.name || 'Desconhecido'}</p>}</div></div><button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button></div><div className="flex border-b border-slate-200 px-6 shrink-0 bg-white gap-6"><button onClick={() => setActiveTab('details')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><FileText size={16}/> Detalhes</button>{task && (<button onClick={() => setActiveTab('comments')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'comments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><MessageSquare size={16}/> Comentários <span className={`px-1.5 rounded-full text-xs ${activeTab === 'comments' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{task.comments.length}</span></button>)}{task && (<button onClick={() => setActiveTab('history')} className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><History size={16}/> Histórico</button>)}</div><div className="flex-1 overflow-y-auto p-8 bg-white">{activeTab === 'details' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-2 space-y-6"><div><label className="block text-sm font-bold text-slate-700 mb-1">Título</label><input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all font-bold text-lg text-slate-800 placeholder-slate-400" value={title} onChange={e => setTitle(e.target.value)} placeholder="O que precisa ser feito?" /></div><div><label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label><textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all min-h-[150px] text-slate-700 placeholder-slate-400" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da tarefa..." /></div><div><label className="block text-sm font-bold text-slate-700 mb-2">Anexos</label><div className="flex flex-wrap gap-3">{attachments.map(att => (<div key={att.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-700"><FileText size={16} className="text-slate-400" /><a href={att.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[150px] font-medium">{att.name}</a><button onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))} className="text-slate-400 hover:text-red-500 transition-colors"><X size={14}/></button></div>))}<label className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 border-dashed px-4 py-2 rounded-lg text-sm text-slate-600 font-medium cursor-pointer transition-all hover:border-slate-400"><Upload size={16} /> Adicionar Arquivo<input type="file" multiple className="hidden" onChange={handleFileUpload} /></label></div></div></div><div className="space-y-6"><div className="bg-slate-50 p-5 rounded-2xl space-y-5 border border-slate-200 shadow-sm"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Status</label><select className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>{Object.entries(TASK_STATUS_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.label}</option>))}</select></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Prioridade</label><select className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Responsável</label><select className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Prazo (Data e Hora)</label><input type="datetime-local" className={`w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none ${isOverdue ? 'border-red-300 text-red-600 bg-red-50' : ''}`} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tags (separar por vírgula)</label><input type="text" className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="dev, marketing..." value={tagsInput} onChange={e => setTagsInput(e.target.value)} /></div></div></div></div>)}{activeTab === 'comments' && task && (<div className="flex flex-col h-full"><div className="flex-1 space-y-4 overflow-y-auto pr-2 mb-4">{task.comments.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-slate-400"><MessageSquare size={32} className="mb-2 opacity-50"/><p>Nenhum comentário ainda.</p></div>}{task.comments.map(c => { const user = users.find(u => u.id === c.userId); return (<div key={c.id} className="flex gap-4 group"><img src={user ? getUserAvatar(user) : getUserAvatar({ name: "Unknown", avatar: "" } as User)} className="w-10 h-10 rounded-full mt-1 border border-slate-200" /><div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-200 flex-1 hover:border-slate-300 transition-colors shadow-sm"><div className="flex justify-between items-baseline mb-2"><span className="font-bold text-slate-800 text-sm">{user?.name}</span><span className="text-xs text-slate-400">{c.createdAt.toLocaleString()}</span></div><p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.text}</p></div></div>) })}</div><div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-auto shadow-inner"><textarea className="w-full bg-transparent text-sm focus:outline-none min-h-[80px] placeholder-slate-400 text-slate-700 resize-none" placeholder="Escreva um comentário... (Use @ para mencionar)" value={commentText} onChange={e => setCommentText(e.target.value)}></textarea><div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200"><span className="text-xs text-slate-400 font-medium">Mencione @Nome para notificar</span><button onClick={handleSendComment} disabled={!commentText.trim()} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">Enviar</button></div></div></div>)}{activeTab === 'history' && task && (<div className="space-y-0">{task.history.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()).map((h, i) => { const user = users.find(u => u.id === h.userId); return (<div key={h.id} className="flex gap-4 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors"><div className="flex flex-col items-center"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200"><History size={14}/></div>{i !== task.history.length - 1 && <div className="w-px h-full bg-slate-200 my-1"></div>}</div><div className="text-sm pt-1"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-800">{user?.name}</span><span className="text-xs text-slate-400">{h.timestamp.toLocaleString()}</span></div><p className="text-slate-600">{h.action}</p></div></div>) })}</div>)}</div><div className="p-6 border-t border-slate-100 flex justify-between gap-3 shrink-0 bg-slate-50 rounded-b-3xl"><div>{task && onDelete && (currentUser.role === 'admin' || currentUser.role === 'master') && (<button onClick={() => onDelete(task.id)} className="px-6 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all flex items-center gap-2"><Trash2 size={18} /> Deletar</button>)}</div><div className="flex gap-3"><button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button><button onClick={handleSave} className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"><Check size={18} /> Salvar Tarefa</button></div></div></div></div>); };
