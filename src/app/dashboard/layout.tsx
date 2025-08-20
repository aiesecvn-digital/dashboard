'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, Users, Settings, X, Menu, FileText } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const open = () => setSidebarOpen(true);
    const close = () => setSidebarOpen(false);
    const toggle = () => setSidebarOpen((v) => !v);
    window.addEventListener('sidebar:open', open as any);
    window.addEventListener('sidebar:close', close as any);
    window.addEventListener('sidebar:toggle', toggle as any);
    return () => {
      window.removeEventListener('sidebar:open', open as any);
      window.removeEventListener('sidebar:close', close as any);
      window.removeEventListener('sidebar:toggle', toggle as any);
    };
  }, []);

  return (
    <div className="min-h-screen relative">
              {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!sidebarOpen}
        >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 truncate">Navigation</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-700 flex-shrink-0"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="space-y-2">
            <div className="px-2 sm:px-3 py-2">
              <div className="space-y-1">
                {/* oGV Hub with sub-pages */}
                <div className="space-y-1">
                  <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                    oGV Hub
                  </div>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className={`w-full flex items-center px-4 sm:px-6 py-2 text-sm rounded-md transition-colors ${
                      pathname === '/dashboard' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <BarChart3 className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">oGV Dashboard</span>
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/ogv-data')}
                    className={`w-full flex items-center px-4 sm:px-6 py-2 text-sm rounded-md transition-colors ${
                      pathname === '/dashboard/ogv-data' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">oGV Data</span>
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/analytics')}
                    className={`w-full flex items-center px-4 sm:px-6 py-2 text-sm rounded-md transition-colors ${
                      pathname === '/dashboard/analytics' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <TrendingUp className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Analytics</span>
                  </button>
                </div>

                <button
                  onClick={() => router.push('/dashboard/users')}
                  className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                    pathname === '/dashboard/users' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Users className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Users</span>
                </button>
                <button
                  onClick={() => router.push('/dashboard/settings')}
                  className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                    pathname === '/dashboard/settings' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Settings className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Settings</span>
                </button>
              </div>
            </div>
          </nav>
        </div>
      </aside>

              {/* Content wrapper shifts when sidebar open */}
        <div className={`transition-all duration-300 ${sidebarOpen ? 'pl-64 sm:pl-72' : 'pl-0'}`}>
        {children}
      </div>

      {/* No floating toggle; pages trigger via custom events to place button next to their titles */}
    </div>
  );
}


