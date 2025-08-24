'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  Settings, 
  LogOut, 
  Search,
  Bell,
  User,
  Menu,
  Database,
  ClipboardList
} from 'lucide-react';
import { getCurrentUser, signOut, supabase } from '@/lib/supabase';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  useEffect(() => {
    checkUser();
    
    // Listen for sidebar toggle events
    const handleSidebarToggle = () => {
      setSidebarOpen(prev => !prev);
    };
    
    window.addEventListener('sidebar:toggle', handleSidebarToggle);
    
    return () => {
      window.removeEventListener('sidebar:toggle', handleSidebarToggle);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.profile-dropdown')) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }

      // Get user profile to check role
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email, status')
        .eq('id', currentUser.id)
        .single();

      setUser(currentUser);
      setUserProfile(profile);
    } catch (error) {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Function to get page title based on pathname
  const getPageTitle = () => {
    switch (pathname) {
      case '/dashboard':
        return 'Dashboard';
      case '/dashboard/analytics':
        return 'Analytics';
      case '/dashboard/users':
        return 'Users';
      case '/dashboard/settings':
        return 'Settings';
      case '/dashboard/ogv-data':
        return 'oGV Data';
      case '/dashboard/ogv-data/crm':
        return 'CRM';
      default:
        return 'Dashboard';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
        <img src="/giphy.gif" alt="Loading..." className="h-32 w-32 object-contain" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-700"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Notifications */}
            <button className="p-2 rounded-md hover:bg-gray-100 text-gray-700 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative profile-dropdown">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 text-gray-700"
              >
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-900">
                  {userProfile?.full_name || user?.email}
                </span>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        router.push('/dashboard/settings');
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-700"
              aria-label="Close sidebar"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            
            {/* oGV Hub Section */}
            <div className="pt-4 pb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">oGV Hub</h3>
              <div className="space-y-1">
                <a
                  href="/dashboard"
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </a>
                <a
                  href="/dashboard/analytics"
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Analytics</span>
                </a>
                <a
                  href="/dashboard/ogv-data"
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm"
                >
                  <Database className="h-4 w-4" />
                  <span>oGV Data</span>
                </a>
                <a
                  href="/dashboard/ogv-data/crm"
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>CRM</span>
                </a>
              </div>
            </div>
            
            {/* Settings Section */}
            <div className="pt-4 pb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Settings</h3>
              <a
                href="/dashboard/settings"
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </a>
            </div>
            
            {userProfile?.role === 'admin' && (
              <div className="pt-4 pb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin</h3>
                <a
                  href="/dashboard/users"
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-sm"
                >
                  <Users className="h-4 w-4" />
                  <span>Users</span>
                </a>
              </div>
            )}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <p>Logged in as:</p>
              <p className="font-medium text-gray-900 truncate">{userProfile?.full_name || user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Content wrapper shifts when sidebar open */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'pl-64 sm:pl-72' : 'pl-0'}`}>
        {children}
      </div>
    </div>
  );
}