'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  ArrowLeft,
  UserPlus, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Search,
  Filter
} from 'lucide-react';
import { getCurrentUser, supabase } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  created_at: string;
  avatar_url?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'set-goals' | 'utm'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states for add/edit user
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  const checkUserAndLoadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setUser(currentUser);
      await loadUsers();
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password || 'tempPassword123!',
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name
        }
      });

      if (authError) throw authError;

      // Create profile for the new user
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            status: formData.status
          }]);

        if (profileError) throw profileError;
      }

      setShowAddModal(false);
      setFormData({ email: '', full_name: '', password: '', role: 'user', status: 'active' });
      await loadUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Error adding user: ' + (error as any).message);
    }
  };

  const handleUpdateUserStatus = async (userId: string, status: 'active' | 'inactive') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: 'admin' | 'user') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <img src="/giphy.gif" alt="Loading..." className="h-50 w-50 object-contain" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => window.dispatchEvent(new Event('sidebar:toggle'))}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-700"
              aria-label="Toggle sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M3.75 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm.75 5.25a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15z" clipRule="evenodd" /></svg>
            </button>
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Admin</h1>
          </div>
          {activeTab === 'users' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-primary text-white px-3 sm:px-4 py-2 rounded-md hover:brightness-95 flex items-center space-x-1 sm:space-x-2 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add User</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="p-3 sm:p-4 md:p-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex space-x-4 sm:space-x-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('users')}
              className={`text-sm font-medium pb-2 border-b-2 whitespace-nowrap ${activeTab==='users' ? 'border-primary text-primary' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('set-goals')}
              className={`text-sm font-medium pb-2 border-b-2 whitespace-nowrap ${activeTab==='set-goals' ? 'border-primary text-primary' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              Set Goals
            </button>
            <button
              onClick={() => setActiveTab('utm')}
              className={`text-sm font-medium pb-2 border-b-2 whitespace-nowrap ${activeTab==='utm' ? 'border-primary text-primary' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              UTM Links
            </button>
          </div>
        </div>

        {activeTab === 'users' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                        Role
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                        Created
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            </div>
                            <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {user.full_name || 'No name'}
                              </div>
                              <div className="text-sm text-gray-500 truncate">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {user.status === 'inactive' && (
                              <button
                                onClick={() => handleUpdateUserStatus(user.id, 'active')}
                                className="text-green-600 hover:text-green-900"
                                title="Activate"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            {user.status === 'active' && (
                              <button
                                onClick={() => handleUpdateUserStatus(user.id, 'inactive')}
                                className="text-red-600 hover:text-red-900"
                                title="Deactivate"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowEditModal(true);
                              }}
                              className="text-primary hover:brightness-110"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'set-goals' && (
          <AdminGoals />
        )}
        {activeTab === 'utm' && (
          <AdminUtm />
        )}
      </main>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave empty for default password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:brightness-95"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={selectedUser.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={selectedUser.full_name || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedUser.status}
                  onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('profiles')
                        .update({
                          full_name: selectedUser.full_name,
                          role: selectedUser.role,
                          status: selectedUser.status
                        })
                        .eq('id', selectedUser.id);

                      if (error) throw error;
                      setShowEditModal(false);
                      await loadUsers();
                    } catch (error) {
                      console.error('Error updating user:', error);
                    }
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:brightness-95"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminGoals() {
  const [rows, setRows] = useState<Array<{ lc_code: string; goal: number }>>([
    { lc_code: 'FHN', goal: 0 },
    { lc_code: 'Hanoi', goal: 0 },
    { lc_code: 'NEU', goal: 0 },
    { lc_code: 'Danang', goal: 0 },
    { lc_code: 'FHCMC', goal: 0 },
    { lc_code: 'HCMC', goal: 0 },
    { lc_code: 'HCME', goal: 0 },
    { lc_code: 'HCMS', goal: 0 },
    { lc_code: 'Cantho', goal: 0 },
    // National departments
    { lc_code: 'EMT', goal: 0 },
    { lc_code: 'EST', goal: 0 },
    { lc_code: 'Organic', goal: 0 },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phases, setPhases] = useState<Array<{ code: string }>>([]);
  const [selectedPhase, setSelectedPhase] = useState<string>(''); // empty = Global
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Load phases for selector
        const { data: phaseRows } = await supabase
          .from('phases')
          .select('code')
          .order('term', { ascending: false })
          .order('half', { ascending: false });
        setPhases((phaseRows as any[])?.map(r => ({ code: String((r as any).code) })) || []);
      } catch (_) {}
    })();
  }, []);

  const loadGoals = async (phaseCode: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      // Per-phase only
      const { data, error } = await supabase
        .from('lc_goals_phase')
        .select('lc_code, goal')
        .eq('phase_code', phaseCode || '__none__');
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data as any[]) || []) map.set(String(r.lc_code), Number(r.goal) || 0);
      setRows(prev => prev.map(r => ({ ...r, goal: map.get(r.lc_code) ?? 0 })));
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals(selectedPhase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhase]);

  const handleChange = (idx: number, value: string) => {
    const val = Number(value.replace(/[^0-9]/g, '')) || 0;
    setRows(prev => prev.map((r, i) => i===idx ? { ...r, goal: val } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to per-phase table (no global goals)
      const upserts = rows.map(r => ({ lc_code: r.lc_code, phase_code: selectedPhase, goal: r.goal }));
      const { error } = await supabase
        .from('lc_goals_phase')
        .upsert(upserts, { onConflict: 'lc_code,phase_code' });
      if (error) throw error;
      alert('Saved goals');
    } catch (e: any) {
      alert('Save failed: ' + (e?.message || 'unknown error'));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="bg-white rounded-lg border border-gray-200 p-6">Loading goals...</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-gray-900">
          Set Goals Phase&nbsp;
          {selectedPhase
            ? (() => {
                const match = selectedPhase.match(/^(\d+)\.(\d+)$/);
                if (!match) return selectedPhase;
                const num = parseInt(match[1], 10);
                const suffix = match[2];
                if (suffix === '1') {
                  return `S${num}`;
                } else if (suffix === '2') {
                  return `W${num}`;
                } else {
                  return selectedPhase;
                }
              })()
            : ''}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={selectedPhase}
            onChange={(e)=> setSelectedPhase(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            {phases.map(p => (
              <option key={p.code} value={p.code}>{p.code}</option>
            ))}
          </select>
          <button onClick={handleSave} disabled={saving} className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">Save</button>
        </div>
      </div>
      {loadError && (
        <div className="mb-3 text-sm text-red-600">{loadError}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-gray-900 text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2">LC</th>
              <th className="text-left py-2 px-2">Goal {selectedPhase ? `(Phase ${selectedPhase})` : ''}</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const national = new Set(['EMT','EST','Organic']);
              const lcRows = rows
                .map((r, idx) => ({ r, idx }))
                .filter(({ r }) => !national.has(r.lc_code));
              const natRows = rows
                .map((r, idx) => ({ r, idx }))
                .filter(({ r }) => national.has(r.lc_code));
              return (
                <>
                  {lcRows.map(({ r, idx }) => (
                    <tr key={r.lc_code} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium">{r.lc_code}</td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          className="w-32 border border-gray-300 rounded-md px-2 py-1"
                          value={r.goal}
                          onChange={(e) => handleChange(idx, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td className="py-2 px-2 font-semibold" colSpan={2}>National</td>
                  </tr>
                  {natRows.map(({ r, idx }) => (
                    <tr key={r.lc_code} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium">{r.lc_code}</td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          className="w-32 border border-gray-300 rounded-md px-2 py-1"
                          value={r.goal}
                          onChange={(e) => handleChange(idx, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminUtm() {
  const LC_LIST = ['EMT','Organic','EST','FHN','Hanoi','NEU','Danang','FHCMC','HCMC','HCME','HCMS','Cantho'];
  const [rows, setRows] = useState<Array<{ entity_type: 'LC'|'NATIONAL'; entity_code: string; links: string[] }>>(
    LC_LIST.map(code => ({ entity_type: (code==='EMT'||code==='Organic'||code==='EST')?'NATIONAL':'LC', entity_code: code, links: [] }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('utm_links').select('entity_type, entity_code, url');
        if (data && Array.isArray(data)) {
          const grouped = new Map<string, string[]>();
          for (const r of data as any[]) {
            const key = `${r.entity_type}:${r.entity_code}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(String(r.url));
          }
          setRows(prev => prev.map(r => ({ ...r, links: grouped.get(`${r.entity_type}:${r.entity_code}`) || [] })));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const handleLinkChange = (idx: number, linkIdx: number, value: string) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = [...(r.links || [])];
      while (next.length <= linkIdx) next.push('');
      next[linkIdx] = value;
      return { ...r, links: next };
    }));
  };
  const handleAddLink = (idx: number) => setRows(prev => prev.map((r,i)=> i===idx ? { ...r, links: [...r.links, ''] } : r));
  const handleRemoveLink = (idx: number, linkIdx: number) => setRows(prev => prev.map((r,i)=> i===idx ? { ...r, links: r.links.filter((_,j)=> j!==linkIdx) } : r));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Replace all existing links with current editor state (simple approach)
      const { error: delErr } = await supabase.from('utm_links').delete().neq('id', -1);
      if (delErr) throw delErr;
      const inserts = rows.flatMap(r => (r.links || []).filter(Boolean).map(url => ({ entity_type: r.entity_type, entity_code: r.entity_code, url })));
      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('utm_links').insert(inserts);
        if (insErr) throw insErr;
      }
      alert('Saved UTM links and goals');
    } catch (e: any) {
      alert('Save failed: ' + (e?.message || 'unknown error'));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="bg-white rounded-lg border border-gray-200 p-6">Loading UTM settings...</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">UTM Links</h3>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Save</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-gray-900 text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2">Entity</th>
              <th className="text-left py-2 px-2">UTM Links</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const natRows = rows
                .map((r, idx) => ({ r, idx }))
                .filter(({ r }) => r.entity_type === 'NATIONAL');
              const lcRows = rows
                .map((r, idx) => ({ r, idx }))
                .filter(({ r }) => r.entity_type === 'LC');
              const renderRow = ({ r, idx }: any) => (
                <tr key={`${r.entity_type}:${r.entity_code}`} className="border-b border-gray-100 align-top">
                  <td className="py-2 px-2 font-medium">
                    {r.entity_type === 'NATIONAL' ? `National - ${r.entity_code}` : r.entity_code}
                  </td>
                  <td className="py-2 px-2">
                    <div className="space-y-2">
                      {(r.links.length === 0 ? [''] : r.links).map((link: string, j: number) => (
                        <div key={j} className="flex items-center gap-2">
                          <input type="text" placeholder="https://..." className="w-96 border border-gray-300 rounded-md px-2 py-1" value={link} onChange={(e)=>handleLinkChange(idx, j, e.target.value)} />
                          <button onClick={()=>handleRemoveLink(idx, j)} className="px-2 py-1 text-sm text-red-600 hover:text-red-700">Remove</button>
                        </div>
                      ))}
                      <button onClick={()=>handleAddLink(idx)} className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">Add link</button>
                    </div>
                  </td>
                </tr>
              );
              return (
                <>
                  {lcRows.map(renderRow)}
                  <tr className="bg-gray-50">
                    <td className="py-2 px-2 font-semibold" colSpan={2}>National</td>
                  </tr>
                  {natRows.map(renderRow)}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
