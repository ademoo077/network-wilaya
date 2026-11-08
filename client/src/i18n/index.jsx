import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import fr from './fr.json';
import ar from './ar.json';

const dictionaries = { fr, ar };
const I18nContext = createContext(null);

function storedLanguage() {
  try {
    const value = localStorage.getItem('anm-language');
    return value === 'ar' ? 'ar' : 'fr';
  } catch {
    return 'fr';
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(storedLanguage);
  const setLang = (value) => setLangState(value === 'ar' ? 'ar' : 'fr');
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('anm-language', lang); } catch { /* stockage indisponible */ }
  }, [lang]);
  const value = useMemo(() => ({
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    setLang,
    t(key, vars = {}) {
      const template = dictionaries[lang][key] ?? dictionaries.fr[key] ?? key;
      return Object.entries(vars).reduce(
        (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
        template,
      );
    },
  }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('I18nProvider missing');
  return context;
}

export function refLabel(item, lang) {
  if (!item) return '—';
  if (item.name) return item.name;
  if (item.full_name) return item.full_name;
  return lang === 'fr' ? (item.name_fr || item.name_ar || '—') : (item.name_ar || item.name_fr || '—');
}
