import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type ThemeMode,
  type LangMode,
  THEME_KEY,
  LANG_KEY,
  resolveEffectiveTheme,
  applyThemeToDom,
  applyLangToDom,
  readStoredTheme,
  readStoredLang,
} from '../../lib/theme';

export type { ThemeMode, LangMode };
export {
  THEME_KEY,
  LANG_KEY,
  resolveEffectiveTheme,
  applyThemeToDom,
  applyLangToDom,
  readStoredTheme,
  readStoredLang,
};

if (typeof window !== 'undefined') {
  applyThemeToDom(readStoredTheme());
  applyLangToDom(readStoredLang());
}

export const PreferencesControls = ({ compact = false }: { compact?: boolean }) => {
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);
  const [lang, setLang] = useState<LangMode>(readStoredLang);

  useEffect(() => {
    applyThemeToDom(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeToDom('system');
    media.addEventListener?.('change', handler);
    return () => media.removeEventListener?.('change', handler);
  }, [theme]);

  useEffect(() => {
    applyLangToDom(lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  return (
    <div className={`asas-prefs-bar ${compact ? 'is-compact' : ''}`} role="group" aria-label="إعدادات العرض واللغة">
      <div className="asas-theme-capsule" role="radiogroup" aria-label="المظهر">
        <button
          type="button"
          role="radio"
          aria-checked={theme === 'system'}
          aria-label="تلقائي حسب النظام"
          title="تلقائي (System)"
          className={`asas-capsule-btn ${theme === 'system' ? 'is-active' : ''}`}
          onClick={() => setTheme('system')}
        >
          <Monitor size={14} />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={theme === 'light'}
          aria-label="الوضع النهاري"
          title="نهاري (Light)"
          className={`asas-capsule-btn ${theme === 'light' ? 'is-active' : ''}`}
          onClick={() => setTheme('light')}
        >
          <Sun size={14} />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={theme === 'dark'}
          aria-label="الوضع الليلي"
          title="ليلي (Dark)"
          className={`asas-capsule-btn ${theme === 'dark' ? 'is-active' : ''}`}
          onClick={() => setTheme('dark')}
        >
          <Moon size={14} />
        </button>
      </div>

      <button
        type="button"
        className="asas-lang-capsule"
        aria-label={lang === 'ar' ? 'تغيير اللغة إلى الإنجليزية' : 'Switch language to Arabic'}
        onClick={() => setLang((current) => (current === 'ar' ? 'en' : 'ar'))}
      >
        <span className={`asas-lang-option ${lang === 'ar' ? 'is-active' : ''}`}>
          <svg className="asas-flag-icon" viewBox="0 0 24 16" aria-hidden="true">
            <rect width="24" height="5.33" y="0" fill="#CE1126" />
            <rect width="24" height="5.33" y="5.33" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="10.66" fill="#000000" />
            <text x="12" y="10" fontSize="3.6" fontWeight="bold" textAnchor="middle" fill="#007A3D">الله أكبر</text>
          </svg>
          <span>AR</span>
        </span>
        <span className={`asas-lang-option ${lang === 'en' ? 'is-active' : ''}`}>
          <svg className="asas-flag-icon" viewBox="0 0 24 16" aria-hidden="true">
            <rect width="24" height="16" fill="#012169" />
            <path d="M0,0 L24,16 M24,0 L0,16" stroke="#FFFFFF" strokeWidth="2.6" />
            <path d="M0,0 L24,16 M24,0 L0,16" stroke="#C8102E" strokeWidth="1.2" />
            <path d="M12,0 V16 M0,8 H24" stroke="#FFFFFF" strokeWidth="4.2" />
            <path d="M12,0 V16 M0,8 H24" stroke="#C8102E" strokeWidth="2.4" />
          </svg>
          <span>EN</span>
        </span>
      </button>
    </div>
  );
};

export const CustomerFooter = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="customer-footer">
      <div>
        <div className="brand-lockup">
          <div className="brand-tooth">✦</div>
          <span>أسنان الأساس<small>منصة تربط المرضى بطلاب طب الأسنان</small></span>
        </div>
        <p>رعاية أسنان أفضل بالتعاون مع جامعات العراق.</p>
      </div>
      <div className="footer-links">
        <Link to="/how-it-works">كيف تعمل المنصة</Link>
        <Link to="/patients">للمرضى</Link>
        <Link to="/students">للطلاب</Link>
        <Link to="/faq">الأسئلة الشائعة</Link>
      </div>
      <small>© {currentYear} جميع الحقوق محفوظة لشركة الأساس للحلول البرمجية — Version 1.5.0</small>
    </footer>
  );
};
