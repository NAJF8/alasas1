import { Bell, MessageCircle, Menu, UserCog, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { PreferencesControls } from './PreferencesBar';
import { useT } from '../../lib/i18n';

export const Header = () => {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const branding = useBranding();
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || t('مستخدم');
  const isCustomer = Boolean(profile && (profile.role === 'PATIENT' || profile.role === 'STUDENT'));
  const close = () => setOpen(false);
  const logout = () => { void signOut(); close(); };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const supportNumber = String(branding.whatsapp || '').replace(/\D/g, '');
  const supportUrl = branding.whatsapp_enabled !== false && supportNumber ? `https://wa.me/${supportNumber}?text=${encodeURIComponent(branding.whatsapp_message || 'مرحباً، أحتاج مساعدة بخصوص منصة أسنان الأساس')}` : null;
  const notificationDestination = !user
    ? '/login'
    : profile?.role === 'STUDENT'
      ? '/student/search'
      : profile?.role === 'PATIENT'
        ? '/patient/dashboard'
        : '/';

  const roleLabel = profile?.role === 'STUDENT'
    ? t('طالب طب أسنان')
    : profile?.role === 'PATIENT'
      ? t('مريض')
      : profile?.role
        ? t('إدارة')
        : t('مستخدم');

  return (
    <>
      <header className={`customer-header ${open ? 'drawer-is-open' : ''}`}>
        <div className="header-inner">
          <Link to="/" className="brand-lockup" onClick={close}>
            <img
              className="brand-image official-brand-logo"
              src={branding.customer_header_logo_url || branding.logo_url || '/brand/official-logo-light.png'}
              alt="شعار الأساس"
            />
            <span className="brand-title">
              {lang === 'ar' ? branding.platform_arabic_name : branding.platform_english_name}
              <small>{lang === 'ar' ? branding.platform_english_name : 'AL ASAS'}</small>
            </span>
          </Link>
          <nav className={open ? 'header-nav is-open' : 'header-nav'} id="primary-navigation">
            <div className="mobile-drawer-header">
              <span className="mobile-drawer-title">{t('القائمة الرئيسية')}</span>
              <button className="mobile-drawer-close" onClick={close} aria-label={t('إغلاق القائمة')}>
                <X size={20} />
              </button>
            </div>

            {user && !loading && (
              <div className="mobile-drawer-user-card">
                <div className="mobile-user-info">
                  <span className="header-greeting-dot" aria-hidden="true" />
                  <span className="mobile-user-name">{t('أهلاً،')} {name}</span>
                </div>
                <span className="mobile-user-role-badge">{roleLabel}</span>
              </div>
            )}

            <div className="mobile-drawer-links">
              <Link to="/how-it-works" onClick={close}>{t('كيف تعمل المنصة')}</Link>
              <Link to="/patients" onClick={close}>{t('للمرضى')}</Link>
              <Link to="/students" onClick={close}>{t('للطلاب')}</Link>
              {profile?.role === 'STUDENT' && <Link to="/student/verification" onClick={close}>{t('توثيق الطالب')}</Link>}
              <Link to="/faq" onClick={close}>{t('الأسئلة الشائعة')}</Link>
              {user && !loading ? (
                <>
                  {isCustomer && (
                    <Link className="mobile-account-link" to="/profile" onClick={close}>
                      <UserCog size={17} /> {t('الملف الشخصي')}
                    </Link>
                  )}
                  <Link className="mobile-drawer-notif-link" to={notificationDestination} onClick={close}>
                    <Bell size={17} /> {t('الإشعارات')}
                  </Link>
                </>
              ) : null}
            </div>

            <div className="mobile-drawer-prefs">
              <span className="mobile-prefs-label">{t('المظهر واللغة')}</span>
              <PreferencesControls />
            </div>

            <div className="mobile-drawer-footer">
              {user && !loading ? (
                <button className="mobile-logout" onClick={logout}>{t('تسجيل الخروج')}</button>
              ) : (
                <div className="mobile-drawer-auth">
                  <Link className="mobile-auth-link" to="/login" onClick={close}>{t('تسجيل الدخول')}</Link>
                  <Link className="mobile-auth-link mobile-auth-cta" to="/register" onClick={close}>{t('إنشاء حساب')}</Link>
                </div>
              )}
            </div>
          </nav>
          <div className="header-actions">
            {loading || !user ? (
              <>
                <PreferencesControls compact />
                <Link className="icon-button" to={notificationDestination} aria-label={t('الإشعارات')}>
                  <Bell size={19} />
                </Link>
                <Link className="header-login" to="/login">{t('تسجيل الدخول')}</Link>
                <Link className="primary-button header-cta" to="/register">{t('إنشاء حساب')}</Link>
              </>
            ) : (
              <>
                <div className="header-user-badge" title={name}>
                  <span className="header-greeting-dot" aria-hidden="true" />
                  <span className="header-greeting">{t('أهلاً،')} {name}</span>
                </div>
                {isCustomer && (
                  <Link className="header-login inline-flex items-center gap-1" to="/profile" aria-label={t('الملف الشخصي')}>
                    <UserCog size={15} /> {t('الملف الشخصي')}
                  </Link>
                )}
                <Link className="icon-button" to={notificationDestination} aria-label={t('الإشعارات')}>
                  <Bell size={19} />
                </Link>
                <PreferencesControls compact />
                <button className="header-logout" onClick={logout}>{t('تسجيل الخروج')}</button>
              </>
            )}
            <button
              className="menu-button"
              onClick={() => setOpen((current) => !current)}
              aria-label={t('القائمة')}
              aria-expanded={open}
              aria-controls="primary-navigation"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      {open && <div className="mobile-drawer-backdrop" onClick={close} aria-hidden="true" />}
      {supportUrl && (
        <a className="customer-support-fab" href={supportUrl} target="_blank" rel="noopener noreferrer" aria-label={(lang === 'ar' ? branding.whatsapp_label_ar : '') || t('تواصل معنا')}>
          <MessageCircle size={20} />
          <span>{(lang === 'ar' ? branding.whatsapp_label_ar : '') || t('تواصل معنا')}</span>
        </a>
      )}
    </>
  );
};
