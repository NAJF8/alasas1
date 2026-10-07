import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, UserPlus,
  Activity, Calendar, Settings, Bell, LogOut, Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const MENU_ITEMS = [
  { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { path: '/cases', label: 'حالات المرضى', icon: FileText },
  { path: '/requests', label: 'طلبات الطلاب', icon: UserPlus },
  { path: '/matches', label: 'المطابقات الذكية', icon: Activity },
  { path: '/appointments', label: 'المواعيد', icon: Calendar },
  { path: '/users', label: 'المستخدمين', icon: Users },
  { path: '/settings', label: 'الإعدادات', icon: Settings },
];

const getRoleLabel = (role?: string) => {
  switch (role) {
    case 'SUPER_ADMIN': return 'مدير النظام';
    case 'ADMIN': return 'مدير';
    case 'STAFF': return 'موظف';
    default: return 'مستخدم';
  }
};

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row" dir="rtl">

      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col sticky top-0 h-screen border-l border-slate-800">
        <div className="p-6">
          <div className="flex items-center gap-2 text-white">
            <Activity className="w-8 h-8 text-blue-400" />
            <span className="text-xl font-bold">أسنان الأساس</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-blue-600 text-white font-medium shadow-sm' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex flex-col mb-4 px-4">
            <span className="text-white font-medium truncate">{profile?.full_name}</span>
            <span className="text-xs text-blue-400 mt-1">{getRoleLabel(profile?.role)}</span>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
            <LogOut className="w-5 h-5" />
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 sticky top-0">
          <div className="flex items-center md:hidden">
            <button className="text-gray-500 hover:text-gray-900">
              <Menu className="w-6 h-6" />
            </button>
            <span className="mr-4 text-lg font-bold text-gray-900">أسنان الأساس</span>
          </div>

          <div className="hidden md:block" />

          <div className="flex items-center gap-4">
            <button className="relative text-gray-400 hover:text-gray-500">
              <Bell className="w-6 h-6" />
              <span className="absolute top-0 right-0 block w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
            </button>

            <div className="flex items-center gap-3 border-r border-gray-200 pr-4">
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-none">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 mt-1">{getRoleLabel(profile?.role)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>

      </main>
    </div>
  );
};
