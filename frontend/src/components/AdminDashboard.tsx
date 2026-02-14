import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import {
  Users, Building, Activity, DollarSign, Settings, LogOut, Plus, Search,
  MoreHorizontal, ArrowUpRight, CheckCircle, CreditCard, Download, X, AlertCircle, UserCircle, Edit, Trash2
} from 'lucide-react';
import { officeApi, usersApi, analyticsApi, billingApi } from '../api/client';
import { Office, User } from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
  onEnterDemo: () => void;
  onImpersonate: (userId: string) => void;
}

type Tab = 'dashboard' | 'offices' | 'users' | 'billing';

interface OfficeData {
  id: string;
  name: string;
  users: number;
  status: string;
  plan: string;
  logo?: string;
  primaryColor?: string;
  workingHoursEnabled?: boolean;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  enableGoogleChat?: boolean;
  enableRocketChat?: boolean;
  rocketChatUrl?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onEnterDemo, onImpersonate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Real Data States
  const [offices, setOffices] = useState<OfficeData[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showCreateOfficeModal, setShowCreateOfficeModal] = useState(false);
  const [showEditOfficeModal, setShowEditOfficeModal] = useState(false);
  const [editingOffice, setEditingOffice] = useState<OfficeData | null>(null);
  const [hoveredOfficeId, setHoveredOfficeId] = useState<string | null>(null);
  const [officeUsers, setOfficeUsers] = useState<Record<string, User[]>>({});

  // User Modal States
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUserModal, setDeleteUserModal] = useState<{
    userId: string;
    userName: string;
    taskCount: number;
  } | null>(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>('');

  // Analytics & Billing States
  const [analytics, setAnalytics] = useState<any>({
    stats: { totalOffices: 0, totalUsers: 0, totalOnlineUsers: 0, totalRooms: 0 },
    revenue: { mrr: 0, currentMonth: { confirmed: 0, pending: 0 } },
    loginActivity: [],
    engagementBySector: [],
  });
  const [billingPlans, setBillingPlans] = useState<any[]>([]);
  const [billingSummary, setBillingSummary] = useState<any>(null);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load offices
      const officesResponse = await officeApi.getAll();
      const officesData = officesResponse.data.map((office: any) => ({
        id: office.id,
        name: office.name,
        users: office.stats?.users || 0,
        status: 'Active',
        plan: 'Enterprise',
        logo: office.logo,
        primaryColor: office.primaryColor,
        workingHoursEnabled: office.workingHours?.enabled,
        workingHoursStart: office.workingHours?.start,
        workingHoursEnd: office.workingHours?.end,
        enableGoogleChat: office.chatFeatures?.enableGoogleChat,
        enableRocketChat: office.chatFeatures?.enableRocketChat,
        rocketChatUrl: office.chatFeatures?.rocketChatUrl,
      }));

      // Load users
      const usersResponse = await usersApi.getAll();
      const usersData = usersResponse.data;

      setOffices(officesData);
      setUsers(usersData);

      // Load analytics data
      await loadAnalytics();

      // Load billing data
      await loadBilling();
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.response?.data?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const [stats, revenue, loginActivity, engagementBySector] = await Promise.all([
        analyticsApi.getStats(),
        analyticsApi.getRevenue(),
        analyticsApi.getLoginActivity({ period: 'week' }),
        analyticsApi.getEngagementBySector(),
      ]);

      setAnalytics({
        stats: stats.data,
        revenue: revenue.data,
        loginActivity: loginActivity.data,
        engagementBySector: engagementBySector.data,
      });
    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  };

  const loadBilling = async () => {
    try {
      const [plans, summary] = await Promise.all([
        billingApi.getPlans(),
        billingApi.getSummary(),
      ]);

      setBillingPlans(plans.data);
      setBillingSummary(summary.data);
    } catch (err) {
      console.error('Error loading billing:', err);
    }
  };

  const loadOfficeUsers = async (officeId: string) => {
    if (officeUsers[officeId]) return; // Already loaded

    try {
      const response = await officeApi.getUsers(officeId);
      setOfficeUsers(prev => ({ ...prev, [officeId]: response.data }));
    } catch (err) {
      console.error('Error loading office users:', err);
    }
  };

  const handleCreateOffice = async (data: {
    name: string;
    logo?: string;
    primaryColor?: string;
    workingHoursEnabled?: boolean;
    workingHoursStart?: string;
    workingHoursEnd?: string;
  }) => {
    try {
      await officeApi.create(data);
      await loadData(); // Reload data
      setShowCreateOfficeModal(false);
    } catch (err: any) {
      console.error('Error creating office:', err);
      alert(err.response?.data?.message || 'Erro ao criar office');
    }
  };

  const handleEditOffice = async (data: {
    name: string;
    logo?: string;
    primaryColor?: string;
    workingHoursEnabled?: boolean;
    workingHoursStart?: string;
    workingHoursEnd?: string;
  }) => {
    if (!editingOffice) return;

    try {
      await officeApi.updateOffice(editingOffice.id, data);
      await loadData(); // Reload data
      setShowEditOfficeModal(false);
      setEditingOffice(null);
    } catch (err: any) {
      console.error('Error updating office:', err);
      alert(err.response?.data?.message || 'Erro ao atualizar office');
    }
  };

  const openEditModal = (office: OfficeData) => {
    setEditingOffice(office);
    setShowEditOfficeModal(true);
  };

  const handleCreateUser = async (data: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
    jobTitle?: string;
    officeId?: string | null;
    sectorId?: string | null;
  }) => {
    try {
      await usersApi.create(data);
      await loadData(); // Reload data
      setShowCreateUserModal(false);
    } catch (err: any) {
      console.error('Error creating user:', err);
      alert(err.response?.data?.error || 'Erro ao criar usuário');
      throw err;
    }
  };

  const handleEditUser = async (userId: string, data: {
    name?: string;
    role?: 'admin' | 'user' | 'master';
    jobTitle?: string;
    officeId?: string | null;
    sectorId?: string | null;
    password?: string;
  }) => {
    try {
      await usersApi.update(userId, data);
      await loadData(); // Reload data
      setShowEditUserModal(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error updating user:', err);
      alert(err.response?.data?.error || 'Erro ao atualizar usuário');
      throw err;
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      // Buscar quantidade de tarefas do usuário
      const response = await usersApi.getTaskCount(userId);
      const taskCount = response.data.count;

      // Abrir modal com informações
      setDeleteUserModal({ userId, userName, taskCount });
    } catch (err: any) {
      console.error('Error fetching task count:', err);
      alert(err.response?.data?.error || 'Erro ao verificar tarefas do usuário');
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserModal) return;

    try {
      // Se tem tarefas e selecionou destino, transferir primeiro
      if (deleteUserModal.taskCount > 0 && transferTargetUserId) {
        await usersApi.transferTasks(deleteUserModal.userId, transferTargetUserId);
      }

      // Deletar usuário
      await usersApi.delete(deleteUserModal.userId);

      // Recarregar dados
      await loadData();

      // Fechar modal e limpar estado
      setDeleteUserModal(null);
      setTransferTargetUserId('');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert(err.response?.data?.error || 'Erro ao deletar usuário');
    }
  };

  const openEditUserModal = (user: User) => {
    setEditingUser(user);
    setShowEditUserModal(true);
  };

  const renderSidebarItem = (id: Tab, label: string, Icon: React.ElementType) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 w-full p-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        activeTab === id 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={18} /> {label}
    </button>
  );

  return (
    <>
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col hidden md:flex shrink-0 shadow-2xl z-20">
        <div className="p-8 border-b border-slate-800">
          <h1 className="text-2xl font-bold flex items-center gap-3 tracking-tight">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
               <Activity size={20} className="text-white" />
            </div>
            Nexus<span className="text-indigo-400">Master</span>
          </h1>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          {renderSidebarItem('dashboard', 'Dashboard', Activity)}
          {renderSidebarItem('offices', 'Offices', Building)}
          {renderSidebarItem('users', 'Users', Users)}
          {renderSidebarItem('billing', 'Billing', DollarSign)}
        </nav>
        <div className="p-6 border-t border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-slate-400 hover:text-red-400 text-sm font-medium transition-colors w-full p-2 rounded-lg hover:bg-slate-800">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col h-screen">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-6 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h2>
            <p className="text-sm text-slate-500">Manage your virtual ecosystem</p>
          </div>
          <div className="flex gap-4 items-center">
             <button 
              onClick={onEnterDemo}
              className="px-5 py-2.5 text-sm bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-100 font-semibold transition-colors flex items-center gap-2"
            >
              Enter Demo Office <ArrowUpRight size={16} />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white">
              YG
            </div>
          </div>
        </header>

        <div className="flex-1 p-8">
          
          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Active Offices', value: analytics.stats.totalOffices.toString(), icon: Building, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Total Users', value: analytics.stats.totalUsers.toString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Users Online', value: analytics.stats.totalOnlineUsers.toString(), icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'MRR', value: `$${(analytics.revenue.mrr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex items-center gap-5">
                    <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
                      <stat.icon size={28} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                      <p className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-96">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Login Activity (Last 7 Days)</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.loginActivity.map((item: any) => ({
                      name: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
                      logins: item.logins
                    }))} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="logins" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-96">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Engagement by Sector</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.engagementBySector.map((sector: any) => ({
                      name: sector.sectorName,
                      engagement: sector.engagementScore
                    }))} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="engagement" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* OFFICES VIEW */}
          {activeTab === 'offices' && (
             <div className="space-y-6 animate-fade-in">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="relative max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input type="text" placeholder="Search offices..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-slate-700 focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <button
                          onClick={() => setShowCreateOfficeModal(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-colors shadow-lg shadow-indigo-200">
                            <Plus size={18} /> Add Office
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {offices.map(office => (
                            <div key={office.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <Building size={28} />
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${office.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {office.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
                                        {office.status}
                                    </span>
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 mb-1">{office.name}</h4>
                                <p className="text-slate-500 text-sm mb-6 flex items-center gap-2">
                                    Office ID: {office.id}
                                </p>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div
                                      className="bg-slate-50 p-3 rounded-xl relative cursor-pointer hover:bg-slate-100 transition-colors"
                                      onMouseEnter={() => {
                                        setHoveredOfficeId(office.id);
                                        loadOfficeUsers(office.id);
                                      }}
                                      onMouseLeave={() => setHoveredOfficeId(null)}
                                    >
                                        <p className="text-xs text-slate-500 font-medium uppercase">Users</p>
                                        <p className="text-lg font-bold text-slate-800">{office.users}</p>

                                        {hoveredOfficeId === office.id && officeUsers[office.id] && (
                                          <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50">
                                            <h5 className="font-bold text-slate-800 mb-3 text-sm">Users in {office.name}</h5>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                              {officeUsers[office.id].map((user: User) => (
                                                <div key={user.id} className="flex items-center gap-2 text-xs">
                                                  <div className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500' : user.status === 'busy' ? 'bg-red-500' : user.status === 'away' ? 'bg-yellow-500' : 'bg-slate-300'}`}></div>
                                                  <span className="font-medium text-slate-700">{user.name}</span>
                                                  <span className="text-slate-400">({user.role})</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl">
                                        <p className="text-xs text-slate-500 font-medium uppercase">Plan</p>
                                        <p className="text-lg font-bold text-slate-800">{office.plan}</p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Manage Office</button>
                                    <button
                                      onClick={() => openEditModal(office)}
                                      className="text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-lg">
                                      <Settings size={18}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                  </>
                )}
             </div>
          )}

          {/* USERS VIEW */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
                 <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">Todos os Usuários</h3>
                        <div className="flex gap-3">
                            <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg">Filtrar</button>
                            <button
                              onClick={() => setShowCreateUserModal(true)}
                              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 flex items-center gap-2"
                            >
                              <Plus size={18} /> Criar Usuário
                            </button>
                        </div>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Escritório</th>
                                <th className="px-6 py-4">Cargo</th>
                                <th className="px-6 py-4">Permissão</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((user: any) => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
                                                <p className="text-xs text-slate-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-slate-700">
                                            {user.office?.name || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-slate-700">
                                            {user.jobTitle || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                                          user.role === 'master' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                          user.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                          'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {user.role === 'master' ? 'Master' : user.role === 'admin' ? 'Admin' : 'Usuário'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${
                                              user.status === 'online' ? 'bg-green-500' :
                                              user.status === 'busy' ? 'bg-red-500' :
                                              user.status === 'away' ? 'bg-yellow-500' :
                                              'bg-slate-300'
                                            }`}></span>
                                            <span className="text-sm text-slate-600 font-medium capitalize">{user.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => onImpersonate(user.id)}
                                                className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                                                title="Entrar como este usuário"
                                            >
                                                <UserCircle size={18} />
                                            </button>
                                            <button
                                                onClick={() => openEditUserModal(user)}
                                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                title="Editar usuário"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.name)}
                                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Deletar usuário"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
          )}

          {/* BILLING VIEW */}
          {activeTab === 'billing' && (
              <div className="space-y-6 animate-fade-in">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                          <p className="text-indigo-100 font-medium mb-1">MRR Total</p>
                          <h3 className="text-3xl font-bold">
                              ${billingSummary?.totalMRR?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0.00'}
                          </h3>
                      </div>
                      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                          <p className="text-slate-500 font-medium mb-1">Confirmado este mês</p>
                          <h3 className="text-3xl font-bold text-green-600">
                              ${billingSummary?.currentMonth?.totalConfirmed?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0.00'}
                          </h3>
                      </div>
                      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                          <p className="text-slate-500 font-medium mb-1">Pendente este mês</p>
                          <h3 className="text-3xl font-bold text-yellow-600">
                              ${billingSummary?.currentMonth?.totalPending?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0.00'}
                          </h3>
                      </div>
                  </div>

                  {/* Offices Billing Table */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                          <h3 className="text-lg font-bold text-slate-800">Faturamento por Escritório</h3>
                          <button
                              onClick={async () => {
                                  try {
                                      await billingApi.generateCurrentMonth();
                                      await loadBilling();
                                      alert('Pagamentos do mês atual gerados com sucesso!');
                                  } catch (err) {
                                      alert('Erro ao gerar pagamentos');
                                  }
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold"
                          >
                              Gerar Pagamentos do Mês
                          </button>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                  <tr>
                                      <th className="px-6 py-3">Escritório</th>
                                      <th className="px-6 py-3">Usuários</th>
                                      <th className="px-6 py-3">Preço/Usuário</th>
                                      <th className="px-6 py-3">Total Mensal</th>
                                      <th className="px-6 py-3">Último Pagamento</th>
                                      <th className="px-6 py-3 text-right">Ações</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-sm">
                                  {billingPlans.length === 0 ? (
                                      <tr>
                                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                              Nenhum plano de faturamento configurado. Configure o preço por usuário para cada escritório.
                                          </td>
                                      </tr>
                                  ) : (
                                      billingPlans.map((plan: any) => {
                                          const lastPayment = plan.payments[0];
                                          return (
                                              <tr key={plan.id}>
                                                  <td className="px-6 py-4 font-medium text-slate-800">{plan.officeName}</td>
                                                  <td className="px-6 py-4 text-slate-600">{plan.currentUserCount}</td>
                                                  <td className="px-6 py-4">
                                                      <span className="font-semibold text-slate-800">
                                                          ${plan.pricePerUser.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                      </span>
                                                  </td>
                                                  <td className="px-6 py-4 font-bold text-indigo-600">
                                                      ${plan.currentMonthlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="px-6 py-4">
                                                      {lastPayment ? (
                                                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                                              lastPayment.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                              lastPayment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                              'bg-red-100 text-red-700'
                                                          }`}>
                                                              {lastPayment.month}/{lastPayment.year} - {lastPayment.status}
                                                          </span>
                                                      ) : (
                                                          <span className="text-slate-400">Nenhum</span>
                                                      )}
                                                  </td>
                                                  <td className="px-6 py-4 text-right">
                                                      <button
                                                          onClick={() => {
                                                              const newPrice = prompt(`Definir preço por usuário para ${plan.officeName}:`, plan.pricePerUser.toString());
                                                              if (newPrice) {
                                                                  billingApi.updatePlan(plan.id, { pricePerUser: parseFloat(newPrice) })
                                                                      .then(() => loadBilling())
                                                                      .catch(err => alert('Erro ao atualizar'));
                                                              }
                                                          }}
                                                          className="text-indigo-600 hover:text-indigo-800 font-semibold"
                                                      >
                                                          Editar Preço
                                                      </button>
                                                  </td>
                                              </tr>
                                          );
                                      })
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* Create Billing Plans for Offices without one */}
                  {offices.filter(o => !billingPlans.find((p: any) => p.officeId === o.id)).length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                          <h4 className="font-bold text-yellow-800 mb-4">Escritórios sem plano de faturamento:</h4>
                          <div className="space-y-2">
                              {offices
                                  .filter(o => !billingPlans.find((p: any) => p.officeId === o.id))
                                  .map(office => (
                                      <div key={office.id} className="flex justify-between items-center bg-white p-3 rounded-lg">
                                          <span className="font-medium text-slate-800">{office.name}</span>
                                          <button
                                              onClick={() => {
                                                  const price = prompt(`Definir preço por usuário para ${office.name}:`);
                                                  if (price) {
                                                      billingApi.createPlan({ officeId: office.id, pricePerUser: parseFloat(price) })
                                                          .then(() => loadBilling())
                                                          .catch(err => alert('Erro ao criar plano'));
                                                  }
                                              }}
                                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold"
                                          >
                                              Criar Plano
                                          </button>
                                      </div>
                                  ))}
                          </div>
                      </div>
                  )}
              </div>
          )}

        </div>
      </main>

      {/* Create Office Modal */}
      {showCreateOfficeModal && (
        <CreateOfficeModal
          onClose={() => setShowCreateOfficeModal(false)}
          onCreate={handleCreateOffice}
        />
      )}

      {/* Edit Office Modal */}
      {showEditOfficeModal && editingOffice && (
        <EditOfficeModal
          office={editingOffice}
          onClose={() => {
            setShowEditOfficeModal(false);
            setEditingOffice(null);
          }}
          onSave={handleEditOffice}
        />
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <CreateUserModal
          offices={offices}
          onClose={() => setShowCreateUserModal(false)}
          onCreate={handleCreateUser}
        />
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <EditUserModal
          user={editingUser}
          offices={offices}
          onClose={() => {
            setShowEditUserModal(false);
            setEditingUser(null);
          }}
          onSave={(data) => handleEditUser(editingUser.id, data)}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertCircle className="text-amber-500" size={24} />
              Confirmar Exclusão
            </h3>

            <p className="text-slate-600 mb-4">
              Deseja realmente deletar o usuário <strong>{deleteUserModal.userName}</strong>?
            </p>

            {deleteUserModal.taskCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-amber-800 text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Este usuário possui <strong>{deleteUserModal.taskCount} tarefa(s)</strong> atribuída(s).
                </p>

                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Transferir tarefas para:
                </label>
                <select
                  value={transferTargetUserId}
                  onChange={(e) => setTransferTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Deixar sem responsável</option>
                  {users
                    .filter(u => u.id !== deleteUserModal.userId)
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>

                {!transferTargetUserId && (
                  <p className="text-xs text-slate-500 mt-2 italic">
                    Se não selecionar um usuário, as tarefas ficarão sem responsável
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteUserModal(null);
                  setTransferTargetUserId('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Deletar Usuário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

// Create Office Modal Component
interface CreateOfficeModalProps {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    logo?: string;
    primaryColor?: string;
    workingHoursEnabled?: boolean;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    enableGoogleChat?: boolean;
    enableRocketChat?: boolean;
    rocketChatUrl?: string;
  }) => void;
}

const CreateOfficeModal: React.FC<CreateOfficeModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [workingHoursEnabled, setWorkingHoursEnabled] = useState(false);
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('18:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nome é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        logo: logo.trim() || undefined,
        primaryColor: primaryColor || undefined,
        workingHoursEnabled,
        workingHoursStart: workingHoursEnabled ? workingHoursStart : undefined,
        workingHoursEnd: workingHoursEnabled ? workingHoursEnd : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Criar Novo Office</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Nome do Office <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Acme Corp"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Logo URL (opcional)
            </label>
            <input
              type="url"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://exemplo.com/logo.png"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Cor Primária (opcional)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-16 h-10 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#6366f1"
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={workingHoursEnabled}
                onChange={(e) => setWorkingHoursEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">
                Ativar Horário de Trabalho
              </span>
            </label>
          </div>

          {workingHoursEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Início
                </label>
                <input
                  type="time"
                  value={workingHoursStart}
                  onChange={(e) => setWorkingHoursStart(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Fim
                </label>
                <input
                  type="time"
                  value={workingHoursEnd}
                  onChange={(e) => setWorkingHoursEnd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Criando...' : 'Criar Office'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Office Modal Component
interface EditOfficeModalProps {
  office: OfficeData;
  onClose: () => void;
  onSave: (data: {
    name: string;
    logo?: string;
    primaryColor?: string;
    workingHoursEnabled?: boolean;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    enableGoogleChat?: boolean;
    enableRocketChat?: boolean;
    rocketChatUrl?: string;
  }) => void;
}

const EditOfficeModal: React.FC<EditOfficeModalProps> = ({ office, onClose, onSave }) => {
  const [name, setName] = useState(office.name);
  const [logo, setLogo] = useState(office.logo || '');
  const [primaryColor, setPrimaryColor] = useState(office.primaryColor || '#6366f1');
  const [workingHoursEnabled, setWorkingHoursEnabled] = useState(office.workingHoursEnabled || false);
  const [workingHoursStart, setWorkingHoursStart] = useState(office.workingHoursStart || '09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState(office.workingHoursEnd || '18:00');
  const [enableGoogleChat, setEnableGoogleChat] = useState(office.enableGoogleChat || false);
  const [enableRocketChat, setEnableRocketChat] = useState(office.enableRocketChat || false);
  const [rocketChatUrl, setRocketChatUrl] = useState(office.rocketChatUrl || 'https://open.rocket.chat');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nome é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        logo: logo.trim() || undefined,
        primaryColor: primaryColor || undefined,
        workingHoursEnabled,
        workingHoursStart: workingHoursEnabled ? workingHoursStart : undefined,
        workingHoursEnd: workingHoursEnabled ? workingHoursEnd : undefined,
        enableGoogleChat,
        enableRocketChat,
        rocketChatUrl: enableRocketChat ? rocketChatUrl : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Editar Office</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Nome do Office <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Acme Corp"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Logo URL (opcional)
            </label>
            <input
              type="url"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://exemplo.com/logo.png"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Cor Primária (opcional)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-16 h-10 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#6366f1"
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={workingHoursEnabled}
                onChange={(e) => setWorkingHoursEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">
                Ativar Horário de Trabalho
              </span>
            </label>
          </div>

          {workingHoursEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Início
                </label>
                <input
                  type="time"
                  value={workingHoursStart}
                  onChange={(e) => setWorkingHoursStart(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Fim
                </label>
                <input
                  type="time"
                  value={workingHoursEnd}
                  onChange={(e) => setWorkingHoursEnd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
                />
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">Recursos de Chat</h4>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableGoogleChat}
                onChange={(e) => setEnableGoogleChat(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">
                Habilitar Google Chat
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableRocketChat}
                onChange={(e) => setEnableRocketChat(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">
                Habilitar Rocket.Chat
              </span>
            </label>

            {enableRocketChat && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  URL do Servidor Rocket.Chat
                </label>
                <input
                  type="url"
                  value={rocketChatUrl}
                  onChange={(e) => setRocketChatUrl(e.target.value)}
                  placeholder="https://open.rocket.chat"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
                />
                <p className="text-xs text-slate-500 mt-1">
                  URL do servidor Rocket.Chat a ser utilizado (padrão: https://open.rocket.chat)
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
// Create User Modal Component
interface CreateUserModalProps {
  offices: OfficeData[];
  onClose: () => void;
  onCreate: (data: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'user' | 'master';
    jobTitle?: string;
    officeId?: string | null;
    sectorId?: string | null;
  }) => Promise<void>;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ offices, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'master'>('user');
  const [jobTitle, setJobTitle] = useState('');
  const [officeId, setOfficeId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      alert('Nome, email e senha são obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        role,
        jobTitle: jobTitle.trim() || undefined,
        officeId: officeId || null,
        sectorId: null,
      });
    } catch (err) {
      // Error already handled
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Criar Novo Usuário</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Nome Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@empresa.com"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Senha <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Cargo
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ex: Desenvolvedor, Gerente"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Escritório
            </label>
            <select
              value={officeId}
              onChange={(e) => setOfficeId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
            >
              <option value="">Nenhum</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Permissão <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user' | 'master')}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              required
            >
              <option value="user">Usuário</option>
              <option value="admin">Admin</option>
              <option value="master">Master</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Admin pode gerenciar usuários do seu escritório. Master tem acesso total à plataforma.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit User Modal Component
interface EditUserModalProps {
  user: any;
  offices: OfficeData[];
  onClose: () => void;
  onSave: (data: {
    name?: string;
    role?: 'admin' | 'user' | 'master';
    jobTitle?: string;
    officeId?: string | null;
    sectorId?: string | null;
    password?: string;
  }) => Promise<void>;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, offices, onClose, onSave }) => {
  const [name, setName] = useState(user.name || '');
  const [role, setRole] = useState<'admin' | 'user' | 'master'>(user.role || 'user');
  const [jobTitle, setJobTitle] = useState(user.jobTitle || '');
  const [officeId, setOfficeId] = useState<string>(user.officeId || '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nome é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        name: name.trim(),
        role,
        jobTitle: jobTitle.trim() || undefined,
        officeId: officeId || null,
        sectorId: null,
      };

      if (password.trim()) {
        if (password.length < 6) {
          alert('A senha deve ter no mínimo 6 caracteres');
          setIsSubmitting(false);
          return;
        }
        data.password = password.trim();
      }

      await onSave(data);
    } catch (err) {
      // Error already handled
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Editar Usuário</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Email</p>
            <p className="text-sm text-slate-800 font-medium">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Nome Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Cargo
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ex: Desenvolvedor, Gerente"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Escritório
            </label>
            <select
              value={officeId}
              onChange={(e) => setOfficeId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
            >
              <option value="">Nenhum</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Permissão <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user' | 'master')}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              required
            >
              <option value="user">Usuário</option>
              <option value="admin">Admin</option>
              <option value="master">Master</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Admin pode gerenciar usuários do seu escritório
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Nova Senha (opcional)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Deixe em branco para manter a atual"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
              minLength={6}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
