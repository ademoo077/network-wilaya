import { NavLink, Navigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { useI18n } from '../../i18n/index.jsx';
import ReferencesAdmin from './ReferencesAdmin.jsx';
import UsersAdmin from './UsersAdmin.jsx';
import SettingsAdmin from './SettingsAdmin.jsx';
import BackupsAdmin from './BackupsAdmin.jsx';
import AuditAdmin from './AuditAdmin.jsx';
import ImportExportAdmin from './ImportExportAdmin.jsx';
import TrashAdmin from './TrashAdmin.jsx';
import HealthAdmin from './HealthAdmin.jsx';
import ReseauxSociauxAdmin from './ReseauxSociauxAdmin.jsx';

const tabs = [
  ['referentiels', 'admin.references'], ['utilisateurs', 'admin.users'], ['parametres', 'admin.settings'],
  ['reseaux-sociaux', 'nav.socialDirectory'],
  ['sauvegardes', 'admin.backups'], ['audit', 'admin.audit'], ['import-export', 'admin.importExport'], ['corbeille', 'admin.trash'],
  ['sante', 'health.title'],
];
const pages = {
  referentiels: ReferencesAdmin, utilisateurs: UsersAdmin, parametres: SettingsAdmin,
  sauvegardes: BackupsAdmin, audit: AuditAdmin, 'import-export': ImportExportAdmin, corbeille: TrashAdmin,
  sante: HealthAdmin, 'reseaux-sociaux': ReseauxSociauxAdmin,
};

export default function AdminPage() {
  const { onglet } = useParams();
  const { t } = useI18n();
  const Page = pages[onglet];
  if (!Page) return <Navigate to="/admin/referentiels" replace />;
  return <div className="page-container"><PageHeader title={t('nav.admin')} /><nav className="mb-6 flex max-w-full gap-1 overflow-x-auto border-b border-border">{tabs.map(([value, key]) => <NavLink key={value} to={`/admin/${value}`} className={({ isActive }) => `min-h-11 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold ${isActive ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted hover:text-ink'}`}>{t(key)}</NavLink>)}</nav><Page /></div>;
}
