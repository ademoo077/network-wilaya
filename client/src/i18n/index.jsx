import { createContext, useContext, useState, useEffect } from 'react';

const dictionaries = {
  fr: {
    appName: 'Suivi des Anomalies',
    tagline: "Cellule technique - Wilaya d'Alger",
    loginTitle: 'Connexion',
    loginSubtitle: 'Plateforme de suivi des points noirs',
    username: 'Identifiant',
    password: 'Mot de passe',
    submit: 'Se connecter',
    logout: 'Deconnexion',
    welcome: 'Bienvenue',
    errorInvalid: 'Identifiants invalides',
  },
  ar: {
    appName: 'تتبع الامتثال',
    tagline: 'الخلية التقنية - ولاية الجزائر',
    loginTitle: 'تسجيل الدخول',
    loginSubtitle: 'منصة تتبع النقاط السوداء',
    username: 'المستخدم',
    password: 'كلمة المرور',
    submit: 'تسجيل الدخول',
    logout: 'تسجيل الخروج',
    welcome: 'مرحباً',
    errorInvalid: 'بيانات الدخول غير صحيحة',
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('fr');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const t = (key) => dictionaries[lang][key] ?? dictionaries.fr[key] ?? key;
  const value = { lang, dir, setLang, t };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n doit etre utilise dans un I18nProvider');
  return ctx;
}
