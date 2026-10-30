export type ThemeMode = 'system' | 'light' | 'dark';
export type LangMode = 'ar' | 'en';

export const THEME_KEY = 'al-asas-theme';
export const LANG_KEY = 'al-asas-lang';

export const resolveEffectiveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'light' || mode === 'dark') return mode;
  if (mode === 'system' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

export const applyThemeToDom = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const effective = resolveEffectiveTheme(mode);
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.setAttribute('data-theme-mode', mode);
  document.documentElement.classList.toggle('dark', effective === 'dark');
};

export const applyLangToDom = (lang: LangMode) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
};

export const readStoredTheme = (): ThemeMode => {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(THEME_KEY) : null;
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch { /* ignore */ }
  return 'light';
};

export const readStoredLang = (): LangMode => {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(LANG_KEY) : null;
    if (raw === 'ar' || raw === 'en') return raw;
  } catch { /* ignore */ }
  return 'ar';
};
