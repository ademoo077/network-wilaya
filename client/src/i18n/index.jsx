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
    logout: 'Déconnexion',
    welcome: 'Bienvenue',
    errorInvalid: 'Identifiants invalides',
    anomalies: 'Anomalies',
    nouvelleAnomalie: 'Nouvelle anomalie',
    statut_non_traite: 'Non traité',
    statut_en_cours: 'En cours',
    statut_traite: 'Traité',
    total: 'Total',
    searchPlaceholder: 'Recherche…',
    all: 'Tous',
    epic: 'EPIC',
    agent: 'Agent',
    lien: 'Lien',
    actions: 'Actions',
    changerStatut: 'Changer le statut',
    enregistrer: 'Enregistrer',
    enregistrerEtNouveau: 'Enregistrer et nouveau',
    annuler: 'Annuler',
    retour: 'Retour',
    loading: 'Chargement…',
    vide: 'Aucune anomalie',
    date: 'Date',
    domaine: 'Domaine',
    type: 'Type',
    daire: 'Daïra',
    commune: 'Commune',
    gps: 'GPS',
    priorite: 'Priorité',
    haute: 'Haute',
    urgente: 'Urgente',
    normale: 'Normale',
    observations: 'Observations',
    details: 'Détails',
    close: 'Fermer',
    nouveau: 'Nouveau',
    tauxTraitement: 'Taux de traitement',
    delaiMoyen: 'Délai moyen',
    repartitionStatuts: 'Répartition par statut',
    evolutionHebdomadaire: 'Évolution hebdomadaire',
    parCategorie: 'Par catégorie',
    recues: 'Reçues',
    traitees: 'Traitées',
    enRetard: 'En retard',
    urgentes: 'Urgentes',
    nonAffecte: 'Non affecté',
    precedent: 'Précédent',
    suivant: 'Suivant',
    affichage: 'Affichage',
    sur: 'sur',
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
    anomalies: 'الأنشطة',
    nouvelleAnomalie: 'نشاط جديد',
    statut_non_traite: 'غير معالج',
    statut_en_cours: 'قيد المعالجة',
    statut_traite: 'معالج',
    total: 'الإجمالي',
    searchPlaceholder: 'بحث...',
    all: 'الكل',
    epic: 'الإي بي آي سي',
    agent: 'الوكيل',
    lien: 'الرابط',
    actions: 'إجراءات',
    changerStatut: 'تغيير الحالة',
    enregistrer: 'حفظ',
    enregistrerEtNouveau: 'حفظ وإنشاء جديد',
    annuler: 'إلغاء',
    retour: 'رجوع',
    loading: 'جار التحميل...',
    vide: 'لا توجد أنشطة',
    date: 'التاريخ',
    domaine: 'المجال',
    type: 'النوع',
    daire: 'الدائرة',
    commune: 'البلدية',
    gps: 'الإحداثيات',
    priorite: 'الأولوية',
    haute: 'عالية',
    urgente: 'عاجلة',
    normale: 'عادية',
    observations: 'ملاحظات',
    details: 'التفاصيل',
    close: 'إغلاق',
    nouveau: 'جديد',
    tauxTraitement: 'نسبة التحليل',
    delaiMoyen: 'المدة المتوسطة',
    repartitionStatuts: 'توزيع الحالة',
    evolutionHebdomadaire: 'التطور الأسبوعي',
    parCategorie: 'حسب الفئة',
    recues: 'مستلمة',
    traitees: 'معالجة',
    enRetard: 'متأخرة',
    urgentes: 'عاجلة',
    nonAffecte: 'غير مخصص',
    precedent: 'السابق',
    suivant: 'التالي',
    affichage: 'عرض',
    sur: 'من',
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lang') || 'fr'; } catch { return 'fr'; }
  });
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
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
