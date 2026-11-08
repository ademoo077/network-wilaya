import { MapPinOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui/index.js';
import { useI18n } from '../i18n/index.jsx';

export default function NotFoundPage() {
  const { t } = useI18n();
  return <div className="page-container"><EmptyState icon={MapPinOff} title={t('notFound.title')} description={t('notFound.text')} action={<Button as={Link} to="/">{t('notFound.home')}</Button>} /></div>;
}
