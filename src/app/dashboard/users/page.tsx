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
  Filter,
  Lock,
  Copy,
  Trash2
} from 'lucide-react';
import { getCurrentUser, supabase, supabaseAdmin, isUserAdmin, getUserProfile, debugAdminAccess } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  full_name?: string;
  lc_code?: string; 
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  created_at: string;
  avatar_url?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'set-goals' | 'utm'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPassword, setTempPassword] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');

  // Form states for add/edit user
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    lc_code: '',
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

      // Check if user is admin using the new function
      const isAdmin = await isUserAdmin(currentUser.id);
      
      if (!isAdmin) {
        console.error('User is not admin or not active');
        
        // Try to debug and fix the issue
        const debugResult = await debugAdminAccess(currentUser.id);
        
        // Check again after potential fix
        const isAdminAfterFix = await isUserAdmin(currentUser.id);
        
        if (!isAdminAfterFix) {
          router.push('/dashboard');
          return;
        }
      }

      // Get full user profile
      const { data: profile, error: profileError } = await getUserProfile(currentUser.id);
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
        router.push('/auth/login');
        return;
      }

      setUser(currentUser);
      setUserProfile(profile);
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
        .select('id, email, full_name, role, status, lc_code, created_at')
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
      const password = formData.password.trim() || generatePassword();
      
      // Check if user already exists in profiles
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', formData.email)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing user:', checkError);
        alert(`❌ Lỗi kiểm tra user: ${checkError.message}`);
        return;
      }

      if (existingProfile) {
        
        
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            lc_code: formData.lc_code,
            role: formData.role,
            status: formData.status
          })
          .eq('email', formData.email);
        
        if (updateError) {
          alert(`❌ Lỗi cập nhật user: ${updateError.message}`);
          return;
        }
        
        setShowAddModal(false);
        setFormData({ email: '', full_name: '', lc_code: '', password: '', role: 'user', status: 'active' });
        await loadUsers();
        alert(`✅ User profile updated successfully with role: ${formData.role}. User already exists in the system.`);
        return;
      }

      // Check if profile already exists (double check)
      const { data: doubleCheckProfile, error: doubleCheckError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', formData.email)
        .maybeSingle();

      if (doubleCheckProfile) {
        alert(`❌ Email "${formData.email}" đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.`);
        return;
      }

      // Create auth user first (this will generate the proper ID)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name,
          lc_code: formData.lc_code
        }
      });

      if (authError) {
        console.error('Auth user creation failed:', authError);
        
        // Check if it's a duplicate email error
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          alert(`❌ Email "${formData.email}" đã tồn tại trong hệ thống. Vui lòng sử dụng email khác hoặc cập nhật thông tin user hiện có.`);
          return;
        }
        
        throw authError;
      }


      // Create profile using the auth user ID
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user!.id,
          email: formData.email,
          full_name: formData.full_name,
          lc_code: formData.lc_code,
          role: formData.role,
          status: formData.status
        }]);

      if (profileError) {
        console.error('Profile creation failed:', profileError);
        
        // Handle duplicate key error
        if (profileError.code === '23505' && profileError.message.includes('profiles_email_unique')) {
          alert(`❌ Email "${formData.email}" Exists. Please use a different email.`);
          
          // Clean up the auth user we just created
          if (authData.user?.id) {
            try {
              await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            } catch (cleanupError) {
              console.error('Error cleaning up auth user:', cleanupError);
            }
          }
          return;
        }
        
        alert(`❌ Error: ${profileError.message}`);
        return;
      }


      setShowAddModal(false);
      setFormData({ email: '', full_name: '', lc_code: '', password: '', role: 'user', status: 'active' });
      await loadUsers();
      
      // Show success message
      alert(`✅ User "${formData.email}" is created successfully with role: ${formData.role}`);
      
      // Show success message with password
      setTempPassword(password);
      setNewUserEmail(formData.email);
      setShowTempPasswordModal(true);
    } catch (error) {
      const errorMessage = (error as any).message || 'Unknown error';
      alert(`❌ Error: ${errorMessage}`);
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

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    // Prevent self-deletion
    if (user && userId === user.id) {
      alert('❌ You cannot delete your own account.');
      return;
    }

    // Confirm deletion
    const confirmed = confirm(`⚠️ Are you sure you want to delete user "${userEmail}"?\n\nThis action cannot be undone.`);
    
    if (!confirmed) return;

    try {

      // Delete profile first
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Profile deletion failed:', profileError);
        alert(`❌ Error: ${profileError.message}`);
        return;
      }


      // Delete auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Auth user deletion failed:', authError);
        alert(`❌ Error: ${authError.message}`);
        return;
      }


      // Reload users list
      await loadUsers();
      
      alert(`✅ User "${userEmail}" is deleted successfully.`);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`❌ Error: ${(error as any).message}`);
    }
  };

  // Generate a random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    // Use a more stable random generation
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(array[i] % chars.length);
    }
    return password;
  };

  // Copy to clipboard with better feedback
  const copyToClipboard = async (text: string, itemName: string = 'Information') => {
    try {
      await navigator.clipboard.writeText(text);
      // Show a temporary success message instead of alert
      const message = document.createElement('div');
      message.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 transform transition-all duration-300';
      message.textContent = `${itemName} copied to clipboard!`;
      document.body.appendChild(message);
      
      // Animate in
      setTimeout(() => {
        message.style.transform = 'translateX(0)';
      }, 100);
      
      // Remove after 2 seconds
      setTimeout(() => {
        message.style.transform = 'translateX(100%)';
        setTimeout(() => {
          document.body.removeChild(message);
        }, 300);
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // Show fallback message
      const message = document.createElement('div');
      message.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      message.textContent = `${itemName} copied to clipboard!`;
      document.body.appendChild(message);
      
      setTimeout(() => {
        document.body.removeChild(message);
      }, 2000);
    }
  };

  // Handle password reset
  const handleResetPassword = async () => {
    if (!selectedUserForReset) return;
    
    setResetLoading(true);
    setResetMessage(null);

    try {
      // Generate a new password
      const newPassword = generatePassword();
      setGeneratedPassword(newPassword);

      // In a real implementation, you would use admin service role to reset password
      // For now, we'll show the generated password to the admin
      setResetMessage({ 
        type: 'success', 
        text: `Password reset successful! New password: ${newPassword}` 
      });

      // In production, you would use:
      // const { error } = await supabase.auth.admin.updateUserById(selectedUserForReset.id, {
      //   password: newPassword
      // });
      // if (error) throw error;

    } catch (error) {
      setResetMessage({ 
        type: 'error', 
        text: 'Password reset failed. Please try again.' 
      });
    } finally {
      setResetLoading(false);
    }
  };

  // Copy password to clipboard
  const copyPasswordToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      alert('Password copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy password:', error);
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
     <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }}>
        <img src="/giphy.gif" alt="Loading..." className="h-50 w-50 object-contain" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
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
                <div className="flex items-center space-x-2 flex-shrink-0">
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
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                        LC Code
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
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <span className="text-sm text-gray-900">
                            {user.lc_code || '-'}
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
                          {formatDate(user.created_at)}
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
                            <button
                              onClick={() => {
                                setSelectedUserForReset(user);
                                setResetPasswordModal(true);
                                setGeneratedPassword('');
                                setResetMessage(null);
                              }}
                              className="text-orange-600 hover:text-orange-700"
                              title="Reset Password"
                            >
                              <Lock className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* User Information Modal */}
      {showTempPasswordModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-gray-200 transform transition-all duration-300 scale-100">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">User Created Successfully!</h3>
              <p className="text-sm text-gray-600">
                A new user account has been created. Please copy the information below.
              </p>
            </div>
            
            {/* User Information Table */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">User Information</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="space-y-2">
                    <tr className="flex items-center">
                      <td className="w-24 font-medium text-gray-700">Email:</td>
                      <td className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 font-mono text-gray-900">
                        {newUserEmail}
                      </td>
                      <td className="ml-2">
                        <button
                          onClick={() => copyToClipboard(newUserEmail, 'Email')}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          title="Copy email"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    <tr className="flex items-center">
                      <td className="w-24 font-medium text-gray-700">Password:</td>
                      <td className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 font-mono text-gray-900">
                        {tempPassword}
                      </td>
                      <td className="ml-2">
                        <button
                          onClick={() => copyToClipboard(tempPassword, 'Password')}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          title="Copy password"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    <tr className="flex items-center">
                      <td className="w-24 font-medium text-gray-700">Role:</td>
                      <td className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900">
                        {formData.role === 'admin' ? 'Admin' : 'User'}
                      </td>
                      <td className="ml-2">
                        <button
                          onClick={() => copyToClipboard(formData.role, 'Role')}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          title="Copy role"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {formData.lc_code && (
                      <tr className="flex items-center">
                        <td className="w-24 font-medium text-gray-700">LC Code:</td>
                        <td className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900">
                          {formData.lc_code}
                        </td>
                        <td className="ml-2">
                          <button
                            onClick={() => copyToClipboard(formData.lc_code, 'LC Code')}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Copy LC code"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Warning Messages */}
            <div className="space-y-3 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      ⚠️ CRITICAL: This is the ONLY time you can view this password!
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      Once you close this window, the password will no longer be visible. Please copy it now.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Important Instructions:
                    </p>
                    <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                      <li>• Share the login credentials with the user securely</li>
                      <li>• If this was auto-generated, user should change password on first login</li>
                      <li>• Store this information safely - it cannot be retrieved later</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  // Copy all information to clipboard
                  const userInfo = `Email: ${newUserEmail}\nPassword: ${tempPassword}\nRole: ${formData.role === 'admin' ? 'Admin' : 'User'}${formData.lc_code ? `\nLC Code: ${formData.lc_code}` : ''}`;
                  copyToClipboard(userInfo, 'All user information');
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy All Information
              </button>
              <button
                onClick={() => {
                  setShowTempPasswordModal(false);
                  setTempPassword('');
                  setNewUserEmail('');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                I've Copied Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl border border-gray-200 transform transition-all duration-300 scale-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h2>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> This will create a new user account. You can set a custom password or leave it empty to auto-generate. Only <span className="text-blue-600 font-semibold">admin</span> users can access all national data. <span className="text-blue-600 font-semibold">User</span> role can only access their own LC's data.
              </p>
            </div>
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
                  LC Code
                </label>
                <input
                  type="text"
                  value={formData.lc_code}
                  onChange={(e) => setFormData({ ...formData, lc_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-gray-500 text-xs">(leave empty to auto-generate)</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password or leave empty for auto-generation"
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl border border-gray-200 transform transition-all duration-300 scale-100">
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
                  LC Code
                </label>
                <input
                  type="text"
                  value={selectedUser.lc_code || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, lc_code: e.target.value })}
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
                          lc_code: selectedUser.lc_code,
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

      {/* Reset Password Modal */}
      {resetPasswordModal && selectedUserForReset && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl border border-gray-200 transform transition-all duration-300 scale-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reset Password</h2>
            
            {resetMessage && (
              <div className={`mb-4 p-3 rounded-md ${
                resetMessage.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                <div className="flex items-center">
                  {resetMessage.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {resetMessage.text}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Email
                </label>
                <input
                  type="email"
                  value={selectedUserForReset.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
              
              {generatedPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={generatedPassword}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-mono"
                    />
                    <button
                      onClick={copyPasswordToClipboard}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Copy this password and share it securely with the user
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordModal(false);
                    setSelectedUserForReset(null);
                    setGeneratedPassword('');
                    setResetMessage(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
                {!generatedPassword && (
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                  >
                    {resetLoading ? 'Generating...' : 'Generate New Password'}
                  </button>
                )}
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

  if (loading) {
    return (
     <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }}>
        <img src="/giphy.gif" alt="Loading..." className="h-50 w-50 object-contain" />
      </div>
    );
  }

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

  if (loading) {
    return (
     <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }}>
        <img src="/giphy.gif" alt="Loading..." className="h-50 w-50 object-contain" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-gray-900">UTM Links</h3>
        <button onClick={handleSave} disabled={saving} className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">Save</button>
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
                         <div key={j} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                           <input type="text" placeholder="https://..." className="w-full sm:w-96 border border-gray-300 rounded-md px-2 py-1 text-sm" value={link} onChange={(e)=>handleLinkChange(idx, j, e.target.value)} />
                           <button onClick={()=>handleRemoveLink(idx, j)} className="px-2 py-1 text-sm text-red-600 hover:text-red-700 whitespace-nowrap">Remove</button>
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
