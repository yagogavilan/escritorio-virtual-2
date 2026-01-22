
export type UserStatus = 'online' | 'busy' | 'away' | 'offline' | 'in-meeting';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'user' | 'master' | 'visitor';
  sector: string;
  jobTitle?: string; // Cargo
  status: UserStatus;
  statusMessage?: string;
  currentRoomId?: string; // If in a meeting room
  visitorInviteId?: string; // If user is a visitor
}

export interface Room {
  id: string;
  name: string;
  type: 'fixed';
  participants: string[]; // User IDs
  capacity?: number;
  isRestricted: boolean;
  color?: string;
  backgroundImage?: string;
  icon?: string;
}

export interface Sector {
  id: string;
  name: string;
  color: string;
}

export interface WorkingHours {
    enabled: boolean;
    start: string; // "09:00"
    end: string;   // "18:00"
}

export interface VisitorInvite {
    id: string;
    code: string;
    expiresAt: Date;
    creatorId: string;
    durationInMinutes: number;
    usedBy?: string; // User ID if currently in use
}

export interface Office {
  id: string;
  name: string;
  logo: string;
  primaryColor?: string; // Hex color for branding
  workingHours?: WorkingHours;
  visitorInvites: VisitorInvite[];
  users: User[];
  rooms: Room[];
  sectors: Sector[];
}

export interface CallState {
  isActive: boolean;
  participants: User[];
  type: 'audio' | 'video';
  roomId?: string; // If connected to a specific room
  isScreenSharing: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  editedAt?: Date;
  readBy: string[]; // Array of User IDs who read the message
  mentions: string[]; // Array of User IDs mentioned
}

export interface ChatChannel {
  id: string;
  type: 'dm' | 'group';
  name?: string; // For groups
  participants: string[]; // User IDs
  messages: ChatMessage[];
  unreadCount?: number;
  lastMessageAt?: Date;
}

export interface Announcement {
    id: string;
    senderId: string;
    title: string;
    message: string;
    imageUrl?: string;
    soundUrl?: string; // URL or base64
    createdAt: Date;
    scheduledFor?: Date; // If null, instant
    recipients: 'all' | string[]; // 'all' or array of User IDs
    readBy: string[];
}

// --- TASK MANAGEMENT TYPES ---

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskAttachment {
    id: string;
    name: string;
    url: string;
    type: string; // mime type
    size: number;
}

export interface TaskComment {
    id: string;
    userId: string;
    text: string;
    createdAt: Date;
    mentions: string[]; // User IDs
}

export interface TaskHistory {
    id: string;
    userId: string;
    action: string; // e.g., "changed status to done", "assigned to Bob"
    timestamp: Date;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId: string; // User ID
    creatorId: string; // User ID
    dueDate?: Date;
    tags: string[];
    attachments: TaskAttachment[];
    comments: TaskComment[];
    history: TaskHistory[];
    createdAt: Date;
}
