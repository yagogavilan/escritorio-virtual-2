
import { Office, User } from './types';

export const SECTORS = [
  { id: 'tech', name: 'Technology', color: 'bg-blue-500' },
  { id: 'sales', name: 'Sales', color: 'bg-green-500' },
  { id: 'hr', name: 'Human Resources', color: 'bg-purple-500' },
  { id: 'mkt', name: 'Marketing', color: 'bg-pink-500' },
  { id: 'exec', name: 'Executive', color: 'bg-slate-800' },
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Admin User',
    email: 'admin@example.com',
    avatar: 'https://picsum.photos/200/200?random=1',
    role: 'master',
    sector: 'exec',
    status: 'online',
    statusMessage: 'Managing the platform',
  },
  {
    id: 'u2',
    name: 'Sarah Connor',
    email: 'sarah@tech.com',
    avatar: 'https://picsum.photos/200/200?random=2',
    role: 'user',
    sector: 'tech',
    status: 'busy',
    statusMessage: 'Coding deep dive',
  },
  {
    id: 'u3',
    name: 'John Doe',
    email: 'john@sales.com',
    avatar: 'https://picsum.photos/200/200?random=3',
    role: 'user',
    sector: 'sales',
    status: 'in-meeting',
    currentRoomId: 'r1',
  },
  {
    id: 'u4',
    name: 'Alice Smith',
    email: 'alice@hr.com',
    avatar: 'https://picsum.photos/200/200?random=4',
    role: 'user',
    sector: 'hr',
    status: 'away',
    statusMessage: 'Lunch break',
  },
  {
    id: 'u5',
    name: 'Bob Martin',
    email: 'bob@tech.com',
    avatar: 'https://picsum.photos/200/200?random=5',
    role: 'user',
    sector: 'tech',
    status: 'online',
  },
   {
    id: 'u6',
    name: 'Eva Green',
    email: 'eva@mkt.com',
    avatar: 'https://picsum.photos/200/200?random=6',
    role: 'user',
    sector: 'mkt',
    status: 'online',
    statusMessage: 'Designing assets',
  },
];

export const MOCK_ROOMS = [
  { id: 'r1', name: 'General Meeting', type: 'fixed', participants: ['u3'], isRestricted: false, capacity: 50, color: '#4f46e5' },
  { id: 'r2', name: 'Tech Standup', type: 'fixed', participants: [], isRestricted: false, capacity: 10, color: '#0ea5e9' },
  { id: 'r3', name: 'Sales War Room', type: 'fixed', participants: [], isRestricted: true, capacity: 8, color: '#10b981' },
  { id: 'r4', name: 'Quiet Zone', type: 'fixed', participants: [], isRestricted: false, capacity: 4, color: '#64748b' },
] as const;

export const DEMO_OFFICE: Office = {
  id: 'off1',
  name: 'reune.io HQ',
  logo: 'https://picsum.photos/100/100?random=99',
  users: MOCK_USERS,
  rooms: [...MOCK_ROOMS] as any,
  sectors: SECTORS,
  visitorInvites: [],
};
