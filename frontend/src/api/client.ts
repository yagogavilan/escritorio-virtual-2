import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  visitorLogin: (name: string, code: string) =>
    api.post('/auth/visitor', { name, code }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Users API
export const usersApi = {
  getAll: () => api.get('/users'),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  updateStatus: (id: string, status: string, statusMessage?: string) =>
    api.patch(`/users/${id}/status`, { status, statusMessage }),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// Office API
export const officeApi = {
  get: () => api.get('/office'),
  update: (data: any) => api.put('/office', data),
  getAll: () => api.get('/office/all'), // Master only
  create: (data: any) => api.post('/office/create', data), // Master only
  updateOffice: (id: string, data: any) => api.put(`/office/${id}`, data), // Master only
  delete: (id: string) => api.delete(`/office/${id}`), // Master only
  getUsers: (id: string) => api.get(`/office/${id}/users`), // Master only
};

// Sectors API
export const sectorsApi = {
  getAll: () => api.get('/sectors'),
  create: (data: { name: string; color: string }) => api.post('/sectors', data),
  update: (id: string, data: any) => api.put(`/sectors/${id}`, data),
  delete: (id: string) => api.delete(`/sectors/${id}`),
};

// Rooms API
export const roomsApi = {
  getAll: () => api.get('/rooms'),
  create: (data: any) => api.post('/rooms', data),
  update: (id: string, data: any) => api.put(`/rooms/${id}`, data),
  delete: (id: string) => api.delete(`/rooms/${id}`),
  join: (id: string) => api.post(`/rooms/${id}/join`),
  leave: (id: string) => api.post(`/rooms/${id}/leave`),
  knock: (id: string) => api.post(`/rooms/${id}/knock`),
};

// Invites API
export const invitesApi = {
  getAll: () => api.get('/invites'),
  create: (durationInMinutes: number) =>
    api.post('/invites', { durationInMinutes }),
  delete: (id: string) => api.delete(`/invites/${id}`),
  validate: (code: string) => api.get(`/invites/validate/${code}`),
};

// Channels API
export const channelsApi = {
  getAll: () => api.get('/channels'),
  create: (type: 'dm' | 'group', participantIds: string[], name?: string) =>
    api.post('/channels', { type, participantIds, name }),
  getMessages: (id: string, limit?: number, before?: string) =>
    api.get(`/channels/${id}/messages`, { params: { limit, before } }),
  sendMessage: (id: string, text: string, mentions?: string[]) =>
    api.post(`/channels/${id}/messages`, { text, mentions }),
  markRead: (id: string) => api.post(`/channels/${id}/read`),
};

// Tasks API
export const tasksApi = {
  getAll: (filters?: { status?: string; assigneeId?: string }) =>
    api.get('/tasks', { params: filters }),
  get: (id: string) => api.get(`/tasks/${id}`),
  create: (data: any) => api.post('/tasks', data),
  update: (id: string, data: any) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  addComment: (id: string, text: string, mentions?: string[]) =>
    api.post(`/tasks/${id}/comments`, { text, mentions }),
};

// Announcements API
export const announcementsApi = {
  getAll: (limit?: number) => api.get('/announcements', { params: { limit } }),
  create: (data: any) => api.post('/announcements', data),
  markRead: (id: string) => api.post(`/announcements/${id}/read`),
  delete: (id: string) => api.delete(`/announcements/${id}`),
};

// Upload API
export const uploadApi = {
  avatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  file: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
