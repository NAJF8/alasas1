import { useEffect } from 'react';
import { useLang } from '../../lib/i18n';
import { syncDomLanguage, translateText } from '../../lib/i18nDom';

// Keeps text that is not wrapped in t() (inner pages, error messages, page title)
// in sync with the chosen language. Arabic remains the source text.
export const DomTranslator = () => {
  const lang = useLang();
  useEffect(() => {
    syncDomLanguage(lang);
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    let applied = '';
    let original = document.title;
    const sync = () => {
      if (document.title !== applied) original = document.title; // app changed the title
      applied = lang === 'en' ? translateText(original) : original;
      if (document.title !== applied) document.title = applied;
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      if (document.title === applied) document.title = original;
    };
  }, [lang]);
  return null;
};
