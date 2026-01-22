import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import {
  Users, Building, Activity, DollarSign, Settings, LogOut, Plus, Search,
  MoreHorizontal, ArrowUpRight, CheckCircle, CreditCard, Download, X, AlertCircle
} from 'lucide-react';
import { officeApi, usersApi } from '../api/client';
import { Office, User } from '../types';

const dataActivity = [
  { name: 'Mon', hours: 400, meetings: 24 },
  { name: 'Tue', hours: 300, meetings: 18 },
  { name: 'Wed', hours: 550, meetings: 35 },
  { name: 'Thu', hours: 480, meetings: 28 },
  { name: 'Fri', hours: 390, meetings: 20 },
  { name: 'Sat', hours: 50, meetings: 2 },
  { name: 'Sun', hours: 30, meetings: 1 },
];

const dataSectors = [
  { name: 'Tech', engagement: 85 },
  { name: 'Sales', engagement: 92 },
  { name: 'HR', engagement: 60 },
  { name: 'Mkt', engagement: 74 },
];

interface AdminDashboardProps {
  onLogout: () => void;
  onEnterDemo: () => void;
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
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onEnterDemo }) => {
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

  const invoices = [
    { id: '#INV-2023-001', date: 'Oct 1, 2023', amount: '$2,400.00', status: 'Paid' },
    { id: '#INV-2023-002', date: 'Nov 1, 2023', amount: '$2,400.00', status: 'Paid' },
    { id: '#INV-2023-003', date: 'Dec 1, 2023', amount: '$2,650.00', status: 'Pending' },
  ];

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
        users: 0, // Will be updated when loading users
        status: 'Active',
        plan: 'Enterprise',
        logo: office.logo,
        primaryColor: office.primaryColor,
        workingHoursEnabled: office.workingHoursEnabled,
        workingHoursStart: office.workingHoursStart,
        workingHoursEnd: office.workingHoursEnd,
      }));

      // Load users
      const usersResponse = await usersApi.getAll();
      const usersData = usersResponse.data;

      // Count users per office
      const userCounts: Record<string, number> = {};
      usersData.forEach((user: User) => {
        if (user.officeId) {
          userCounts[user.officeId] = (userCounts[user.officeId] || 0) + 1;
        }
      });

      // Update offices with user counts
      const officesWithCounts = officesData.map((office: OfficeData) => ({
        ...office,
        users: userCounts[office.id] || 0,
      }));

      setOffices(officesWithCounts);
      setUsers(usersData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.response?.data?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
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
                  { label: 'Active Offices', value: '12', icon: Building, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Total Users', value: '1,248', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Avg Online Time', value: '5h 32m', icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Monthly Revenue', value: '$45.2k', icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
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
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Weekly Platform Activity</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataActivity} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="top" height={36}/>
                      <Line type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="meetings" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-96">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Engagement by Sector</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dataSectors} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
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
                        <h3 className="text-lg font-bold text-slate-800">All Users</h3>
                        <div className="flex gap-3">
                            <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg">Filter</button>
                            <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200">Export CSV</button>
                        </div>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(user => (
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
                                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                            <span className="text-sm text-slate-600 font-medium">{user.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors">
                                            <MoreHorizontal size={18} />
                                        </button>
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
              <div className="max-w-4xl space-y-6 animate-fade-in">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-200 flex justify-between items-center">
                      <div>
                          <p className="text-indigo-100 font-medium mb-1">Current Plan</p>
                          <h2 className="text-3xl font-bold mb-4">Enterprise Bundle</h2>
                          <div className="flex gap-6 text-sm text-indigo-100">
                              <span className="flex items-center gap-2"><CheckCircle size={16} /> Unlimited Offices</span>
                              <span className="flex items-center gap-2"><CheckCircle size={16} /> Priority Support</span>
                              <span className="flex items-center gap-2"><CheckCircle size={16} /> Advanced Analytics</span>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="text-indigo-100 font-medium mb-1">Next Payment</p>
                          <h3 className="text-2xl font-bold mb-4">$2,400.00</h3>
                          <button className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-bold text-sm shadow-lg hover:bg-indigo-50 transition-colors">
                              Manage Subscription
                          </button>
                      </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold text-slate-800">Payment Methods</h3>
                          <button className="text-indigo-600 text-sm font-semibold hover:underline">Add New</button>
                      </div>
                      <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50">
                          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                              <CreditCard size={24} className="text-slate-700" />
                          </div>
                          <div className="flex-1">
                              <p className="font-bold text-slate-800 text-sm">Visa ending in 4242</p>
                              <p className="text-slate-500 text-xs">Expiry 12/24</p>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Default</span>
                      </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                       <div className="p-6 border-b border-slate-100">
                          <h3 className="text-lg font-bold text-slate-800">Billing History</h3>
                       </div>
                       <table className="w-full text-left">
                           <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                               <tr>
                                   <th className="px-6 py-3">Invoice</th>
                                   <th className="px-6 py-3">Date</th>
                                   <th className="px-6 py-3">Amount</th>
                                   <th className="px-6 py-3">Status</th>
                                   <th className="px-6 py-3 text-right">Download</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 text-sm">
                               {invoices.map(inv => (
                                   <tr key={inv.id}>
                                       <td className="px-6 py-4 font-medium text-slate-800">{inv.id}</td>
                                       <td className="px-6 py-4 text-slate-500">{inv.date}</td>
                                       <td className="px-6 py-4 font-medium">{inv.amount}</td>
                                       <td className="px-6 py-4">
                                           <span className={`px-2 py-1 rounded-md text-xs font-bold ${inv.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                               {inv.status}
                                           </span>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                           <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                                               <Download size={18} />
                                           </button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                  </div>
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
    </div>
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
  }) => void;
}

const EditOfficeModal: React.FC<EditOfficeModalProps> = ({ office, onClose, onSave }) => {
  const [name, setName] = useState(office.name);
  const [logo, setLogo] = useState(office.logo || '');
  const [primaryColor, setPrimaryColor] = useState(office.primaryColor || '#6366f1');
  const [workingHoursEnabled, setWorkingHoursEnabled] = useState(office.workingHoursEnabled || false);
  const [workingHoursStart, setWorkingHoursStart] = useState(office.workingHoursStart || '09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState(office.workingHoursEnd || '18:00');
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