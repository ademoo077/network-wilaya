import { MapPinOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/index.js';
import { useI18n } from '../i18n/index.jsx';

export default function NotFoundPage() {
  const { t } = useI18n();
  return <div className="page-container grid min-h-[60vh] content-center justify-items-center gap-4 text-center">
    <MapPinOff className="h-14 w-14 text-brand-700" aria-hidden="true" />
    <h1 className="text-2xl font-black">{t('notFound.title')}</h1>
    <p className="text-muted">{t('notFound.text')}</p>
    <Button as={Link} to="/">{t('notFound.home')}</Button>
  </div>;
}
