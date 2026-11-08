import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { IconButton, Button } from './Button.jsx';
import { useI18n } from '../../i18n/index.jsx';

const alertStyles = {
  info: ['border-info text-info', Info], warning: ['border-warning text-warning', TriangleAlert],
  danger: ['border-danger text-danger', AlertCircle], success: ['border-straite text-straite', CheckCircle2],
};

export function Alert({ variant = 'info', title, children, action, className = '' }) {
  const [styles, Icon] = alertStyles[variant];
  return <div role={variant === 'danger' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-md border bg-surface px-4 py-3 ${styles} ${className}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div className="min-w-0 flex-1 text-sm">{title && <p className="font-bold">{title}</p>}<div className={title ? 'mt-1 text-ink2' : ''}>{children}</div></div>{action}</div>;
}

export function Skeleton({ className = '' }) { return <div className={`animate-pulse rounded-md bg-surface2 ${className}`} aria-hidden="true" />; }

export function LoadingBlock() {
  const { t } = useI18n();
  return <div className="grid gap-3" role="status"><span className="sr-only">{t('common.loading')}</span><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
}

export function EmptyState({ icon: Icon = Info, title, description, action, compact = false }) {
  return <div className={`grid place-items-center text-center ${compact ? 'p-6' : 'p-10'}`}><div className="grid h-14 w-14 place-items-center rounded-xl bg-brand-100 text-brand-800"><Icon className="h-7 w-7" aria-hidden="true" /></div><h3 className="mt-4 font-bold text-ink">{title}</h3>{description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}

const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, variant = 'success', action = null) => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((current) => [...current, { id, message, variant, action }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return <ToastContext.Provider value={value}>{children}<div className="fixed end-4 top-4 z-[100] grid w-[min(92vw,380px)] gap-2" aria-live="polite">{items.map((item) => <Toast key={item.id} {...item} onClose={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} />)}</div></ToastContext.Provider>;
}

function Toast({ message, variant, action, onClose }) {
  const Icon = variant === 'danger' ? AlertCircle : variant === 'warning' ? TriangleAlert : CheckCircle2;
  return <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3 text-sm text-ink shadow-3"><Icon className={`h-5 w-5 ${variant === 'danger' ? 'text-danger' : variant === 'warning' ? 'text-warning' : 'text-straite'}`} aria-hidden="true" /><span className="min-w-0 flex-1">{message}</span>{action && <Button size="sm" variant="ghost" onClick={() => { action.onClick?.(); onClose(); }}>{action.label}</Button>}<IconButton aria-label="×" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></IconButton></div>;
}

export function ErrorState({ message, onRetry }) {
  const { t } = useI18n();
  return <EmptyState icon={AlertCircle} title={t('common.error')} description={message || t('error.load')} action={onRetry && <Button variant="secondary" onClick={onRetry}>{t('common.retry')}</Button>} />;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('ToastProvider missing');
  return value;
}
