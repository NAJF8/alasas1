import { Bell, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isProfileComplete, useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';

export const Header = () => {
  const [open, setOpen] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const branding = useBranding();
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'مستخدم';
  const complete = isProfileComplete(profile);
  const close = () => setOpen(false);
  const logout = () => { void signOut(); close(); };

  return <header className="customer-header">
    <div className="header-inner">
      <Link to="/" className="brand-lockup" onClick={close}>
        {branding.customer_header_logo_url || branding.logo_url ? <img className="brand-image" src={branding.customer_header_logo_url || branding.logo_url || ''} alt={branding.platform_arabic_name} /> : <div className="brand-tooth">✦</div>}
        <span>{branding.platform_arabic_name}<small>{branding.platform_english_name}</small></span>
      </Link>
      <nav className={open ? 'header-nav is-open' : 'header-nav'}>
        <Link to="/how-it-works" onClick={close}>كيف تعمل المنصة</Link>
        <Link to="/patients" onClick={close}>للمرضى</Link>
        <Link to="/students" onClick={close}>للطلاب</Link>
        {profile?.role === 'STUDENT' && <Link to="/student/verification" onClick={close}>توثيق الطالب</Link>}
        <Link to="/faq" onClick={close}>الأسئلة الشائعة</Link>
        {user && !loading ? <>
          <Link className="mobile-account-link" to={complete ? '/dashboard' : '/onboarding'} onClick={close}>{complete ? 'حسابي' : 'أكمل حسابك'}</Link>
          <button className="mobile-logout" onClick={logout}>تسجيل الخروج</button>
        </> : <>
          <Link className="mobile-auth-link" to="/login" onClick={close}>تسجيل الدخول</Link>
          <Link className="mobile-auth-link mobile-auth-cta" to="/register" onClick={close}>إنشاء حساب</Link>
        </>}
      </nav>
      <div className="header-actions">
        <button className="icon-button" aria-label="الإشعارات"><Bell size={19} /></button>
        {loading || !user ? <>
          <Link className="header-login" to="/login">تسجيل الدخول</Link>
          <Link className="primary-button header-cta" to="/register">إنشاء حساب</Link>
        </> : <>
          <span className="header-greeting">أهلاً، {name}</span>
          <Link className="header-login" to={complete ? '/dashboard' : '/onboarding'}>{complete ? 'حسابي' : 'أكمل حسابك'}</Link>
          <button className="header-logout" onClick={logout}>تسجيل الخروج</button>
        </>}
        <button className="menu-button" onClick={() => setOpen((current) => !current)} aria-label="القائمة">{open ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div>
  </header>;
};
