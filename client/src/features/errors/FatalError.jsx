import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function FatalError({ error, onRetry }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const details = String(error?.stack || error?.message || '');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="page-container grid min-h-[70vh] place-items-center">
      <div className="w-full max-w-xl rounded-md border border-danger bg-surface p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-black text-ink">{t('errors.fatal.title')}</h1>
        <p className="mt-2 text-sm text-ink2">{t('errors.fatal.message')}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={onRetry}>{t('errors.fatal.retry')}</Button>
          <Button variant="secondary" onClick={() => { window.location.hash = '#/'; }}>{t('errors.fatal.back')}</Button>
        </div>
        <div className="mt-6">
          <button type="button" className="text-sm font-bold text-brand-700 underline underline-offset-4" onClick={() => setOpen((value) => !value)}>
            {t('errors.fallback.details')}
          </button>
          {open && <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-surface2 p-3 text-start text-xs text-ink2">{details}</pre>}
          <Button variant="secondary" size="sm" className="mt-3" onClick={copy}>{copied ? t('common.copied') : t('common.copy')}</Button>
        </div>
      </div>
    </div>
  );
}
