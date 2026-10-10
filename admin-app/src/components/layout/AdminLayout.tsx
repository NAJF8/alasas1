import { Bell, BookOpen, CalendarDays, ChevronDown, FileHeart, FileText, LayoutDashboard, LogOut, MapPin, Menu, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, University, Users, UserRoundCog, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const MENU = [{ path: '/', label: 'لوحة التحكم', icon: LayoutDashboard }, { path: '/users', label: 'المستخدمون', icon: Users }, { path: '/patients', label: 'المرضى', icon: UserRoundCog }, { path: '/students', label: 'طلاب طب الأسنان', icon: Stethoscope }, { path: '/cases', label: 'حالات المرضى', icon: FileHeart }, { path: '/requests', label: 'طلبات الطلاب', icon: FileText }, { path: '/matches', label: 'المطابقات', icon: Sparkles }, { path: '/appointments', label: 'المواعيد', icon: CalendarDays }, { path: '/universities', label: 'الجامعات', icon: University }, { path: '/provinces', label: 'إدارة المحافظات', icon: MapPin }, { path: '/notifications', label: 'الإشعارات', icon: Bell }, { path: '/reports', label: 'التقارير', icon: BookOpen }];
const SYSTEM = [{ path: '/branding', label: 'الهوية والمحتوى', icon: SlidersHorizontal }, { path: '/admins', label: 'إدارة المدراء', icon: ShieldCheck }, { path: '/settings', label: 'الإعدادات', icon: Settings }];
const roleLabel = (role?: string) => role === 'SUPER_ADMIN' ? 'مدير النظام' : role === 'ADMIN' ? 'مدير' : 'موظف';

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = async () => { await signOut(); navigate('/login', { replace: true }); };
  const renderItems = (items: typeof MENU) => items.map(({ path, label, icon: Icon }) => <Link key={path} to={path} onClick={() => setMobileOpen(false)} className={`admin-nav-item ${location.pathname === path || (path !== '/' && location.pathname.startsWith(path)) ? 'active' : ''}`}><Icon size={18} />{label}</Link>);
  return <div className="admin-shell" dir="rtl">
    <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="admin-brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><div>أسنان الأساس<small>لوحة الإدارة</small></div><button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة"><X size={19} /></button></div>
      <div className="admin-menu-label">الرئيسية</div><nav>{renderItems(MENU)}</nav>
      <div className="admin-menu-label">النظام</div><nav>{renderItems(SYSTEM)}</nav>
      <div className="admin-side-profile"><div className="admin-avatar">{profile?.full_name?.charAt(0) || 'م'}</div><div><b>{profile?.full_name || 'مدير المنصة'}</b><small>{roleLabel(profile?.role)}</small></div><button onClick={() => void nav()} aria-label="تسجيل الخروج"><LogOut size={16} /></button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><button className="mobile-menu-trigger" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة"><Menu size={21} /></button><Link className="admin-search" to="/users"><Search size={16} /><span>ابحث في النظام</span><kbd>/</kbd></Link><div className="admin-top-actions"><Link className="top-icon" to="/notifications" aria-label="الإشعارات"><Bell size={19} /><i>3</i></Link><div className="admin-user-menu"><div className="admin-avatar small">{profile?.full_name?.charAt(0) || 'م'}</div><span>{profile?.full_name || 'مدير المنصة'}<small>{roleLabel(profile?.role)}</small></span><ChevronDown size={16} /></div></div></header>
      <div className="admin-content">{children}</div>
    </main>
    {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />}
  </div>;
};
