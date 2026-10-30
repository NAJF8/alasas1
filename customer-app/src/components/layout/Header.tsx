import { Bell, MessageCircle, Menu, UserCog, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isProfileComplete, useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { PreferencesControls } from './PreferencesBar';

export const Header = () => {
  const [open, setOpen] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const branding = useBranding();
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'مستخدم';
  const complete = isProfileComplete(profile);
  const isAuthorizedAdmin = Boolean(profile && profile.status === 'VERIFIED' && ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(profile.role));
  const close = () => setOpen(false);
  const logout = () => { void signOut(); close(); };

  const supportNumber = String(branding.whatsapp || '').replace(/\D/g, '');
  const supportUrl = branding.whatsapp_enabled !== false && supportNumber ? `https://wa.me/${supportNumber}?text=${encodeURIComponent(branding.whatsapp_message || 'مرحباً، أحتاج مساعدة بخصوص منصة أسنان الأساس')}` : null;
  return <><header className="customer-header">
    <div className="header-inner">
      <Link to="/" className="brand-lockup" onClick={close}>
        <img className="brand-image official-brand-logo" src={branding.customer_header_logo_url || branding.logo_url || '/brand/official-logo-light.png'} alt="شعار الأساس" />
        <span>{branding.platform_arabic_name}<small>{branding.platform_english_name}</small></span>
      </Link>
      <nav className={open ? 'header-nav is-open' : 'header-nav'}>
        <Link to="/how-it-works" onClick={close}>كيف تعمل المنصة</Link>
        <Link to="/patients" onClick={close}>للمرضى</Link>
        <Link to="/students" onClick={close}>للطلاب</Link>
        {profile?.role === 'STUDENT' && <Link to="/student/verification" onClick={close}>توثيق الطالب</Link>}
        <Link to="/faq" onClick={close}>الأسئلة الشائعة</Link>
        {user && !loading ? <>
          <Link className="mobile-account-link" to={complete ? '/dashboard' : '/profile'} onClick={close}>{complete ? 'حسابي' : 'تعديل الملف الشخصي'}</Link>
          <Link className="mobile-account-link" to="/profile" onClick={close}>الملف الشخصي</Link>
          <button className="mobile-logout" onClick={logout}>تسجيل الخروج</button>
        </> : <>
          <Link className="mobile-auth-link" to="/login" onClick={close}>تسجيل الدخول</Link>
          <Link className="mobile-auth-link mobile-auth-cta" to="/register" onClick={close}>إنشاء حساب</Link>
        </>}
      </nav>
      <div className="header-actions">
        <PreferencesControls compact />
        <Link className="icon-button" to={user ? (profile?.role === 'STUDENT' ? '/student/search' : '/patient/dashboard') : '/login'} aria-label="الإشعارات"><Bell size={19} /></Link>
        {loading || !user ? <>
          <Link className="header-login" to="/login">تسجيل الدخول</Link>
          <Link className="primary-button header-cta" to="/register">إنشاء حساب</Link>
        </> : <>
          <span className="header-greeting">أهلاً، {name}</span>
          <Link className="header-login" to={complete ? '/dashboard' : '/profile'}>{complete ? 'حسابي' : 'تعديل الملف الشخصي'}</Link>
          <Link className="header-login inline-flex items-center gap-1" to="/profile" aria-label="تعديل الملف الشخصي"><UserCog size={15} /> الملف الشخصي</Link>
          {isAuthorizedAdmin && <a className="header-login" href="/admin/">لوحة الإدارة</a>}
          <button className="header-logout" onClick={logout}>تسجيل الخروج</button>
        </>}
        <button className="menu-button" onClick={() => setOpen((current) => !current)} aria-label="القائمة">{open ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div>
  </header>{supportUrl && <a className="customer-support-fab" href={supportUrl} target="_blank" rel="noopener noreferrer" aria-label={branding.whatsapp_label_ar || 'تواصل معنا'}><MessageCircle size={20} /><span>{branding.whatsapp_label_ar || 'تواصل معنا'}</span></a>}</>;
};
