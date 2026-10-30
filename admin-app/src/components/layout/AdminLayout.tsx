import { Bell, BookOpen, CalendarDays, ChevronDown, FileHeart, FileText, LayoutDashboard, LogOut, MapPin, Menu, Monitor, Moon, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, Sun, University, Users, UserRoundCog, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  type ThemeMode,
  type LangMode,
  THEME_KEY,
  LANG_KEY,
  resolveEffectiveTheme,
  applyTheme,
  applyLang,
  readTheme,
  readLang,
} from '../../lib/theme';

export type { ThemeMode, LangMode };
export {
  THEME_KEY,
  LANG_KEY,
  resolveEffectiveTheme,
  applyTheme,
  applyLang,
  readTheme,
  readLang,
};

if (typeof window !== 'undefined') {
  applyTheme(readTheme());
  applyLang(readLang());
}

const MENU = [
  { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { path: '/users', label: 'المستخدمون', icon: Users },
  { path: '/patients', label: 'المرضى', icon: UserRoundCog },
  { path: '/students', label: 'طلاب طب الأسنان', icon: Stethoscope },
  { path: '/cases', label: 'حالات المرضى', icon: FileHeart },
  { path: '/requests', label: 'طلبات الطلاب', icon: FileText },
  { path: '/registration-requests', label: 'طلبات تسجيل الحسابات', icon: ShieldCheck },
  { path: '/matches', label: 'المطابقات', icon: Sparkles },
  { path: '/appointments', label: 'المواعيد', icon: CalendarDays },
  { path: '/universities', label: 'الجامعات', icon: University },
  { path: '/provinces', label: 'إدارة المحافظات', icon: MapPin },
  { path: '/notifications', label: 'الإشعارات', icon: Bell },
  { path: '/reports', label: 'التقارير', icon: BookOpen },
];
const SYSTEM = [
  { path: '/branding', label: 'الهوية والمحتوى', icon: SlidersHorizontal },
  { path: '/admins', label: 'إدارة المدراء', icon: ShieldCheck },
  { path: '/settings', label: 'الإعدادات', icon: Settings },
];
const roleLabel = (role?: string) => (role === 'SUPER_ADMIN' ? 'مدير النظام' : role === 'ADMIN' ? 'مدير' : 'موظف');

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(readTheme);
  const [lang, setLang] = useState<LangMode>(readLang);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    media.addEventListener?.('change', handler);
    return () => media.removeEventListener?.('change', handler);
  }, [theme]);

  useEffect(() => {
    applyLang(lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const nav = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };
  const renderItems = (items: typeof MENU) =>
    items.map(({ path, label, icon: Icon }) => (
      <Link key={path} to={path} onClick={() => setMobileOpen(false)} className={`admin-nav-item ${location.pathname === path || (path !== '/' && location.pathname.startsWith(path)) ? 'active' : ''}`}>
        <Icon size={18} />
        {label}
      </Link>
    ));

  return (
    <div className="admin-shell" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-brand">
          <img className="admin-brand-logo" src="/brand/official-logo-white.png" alt="شعار الأساس" />
          <div>
            أسنان الأساس<small>لوحة الإدارة</small>
          </div>
          <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة">
            <X size={19} />
          </button>
        </div>
        <div className="admin-menu-label">الرئيسية</div>
        <nav>{renderItems(MENU)}</nav>
        <div className="admin-menu-label">النظام</div>
        <nav>{renderItems(SYSTEM)}</nav>
        <div className="admin-side-profile">
          <div className="admin-avatar">{profile?.full_name?.charAt(0) || 'م'}</div>
          <div>
            <b>{profile?.full_name || 'مدير المنصة'}</b>
            <small>{roleLabel(profile?.role)}</small>
          </div>
          <button onClick={() => void nav()} aria-label="تسجيل الخروج">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu-trigger" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة">
            <Menu size={21} />
          </button>
          <Link className="admin-search" to="/users">
            <Search size={16} />
            <span>ابحث في النظام</span>
            <kbd>/</kbd>
          </Link>
          <div className="admin-top-actions">
            <div className="admin-theme-capsule" role="radiogroup" aria-label="المظهر">
              <button type="button" role="radio" aria-checked={theme === 'system'} aria-label="تلقائي حسب النظام" className={theme === 'system' ? 'is-active' : ''} onClick={() => setTheme('system')}>
                <Monitor size={14} />
              </button>
              <button type="button" role="radio" aria-checked={theme === 'light'} aria-label="الوضع النهاري" className={theme === 'light' ? 'is-active' : ''} onClick={() => setTheme('light')}>
                <Sun size={14} />
              </button>
              <button type="button" role="radio" aria-checked={theme === 'dark'} aria-label="الوضع الليلي" className={theme === 'dark' ? 'is-active' : ''} onClick={() => setTheme('dark')}>
                <Moon size={14} />
              </button>
            </div>
            <button
              type="button"
              className="admin-lang-capsule"
              aria-label={lang === 'ar' ? 'تغيير اللغة إلى الإنجليزية' : 'Switch language to Arabic'}
              onClick={() => setLang((c) => (c === 'ar' ? 'en' : 'ar'))}
            >
              <span className={lang === 'ar' ? 'is-active' : ''}>AR</span>
              <span className={lang === 'en' ? 'is-active' : ''}>EN</span>
            </button>
            <Link className="top-icon" to="/notifications" aria-label="الإشعارات">
              <Bell size={19} />
            </Link>
            <div className="admin-user-menu">
              <div className="admin-avatar small">{profile?.full_name?.charAt(0) || 'م'}</div>
              <span>
                {profile?.full_name || 'مدير المنصة'}
                <small>{roleLabel(profile?.role)}</small>
              </span>
              <ChevronDown size={16} />
            </div>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </main>
      {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />}
    </div>
  );
};
