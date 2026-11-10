import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button.jsx';
import { useI18n } from '../../i18n/index.jsx';

function useModal(open, onClose, panelRef) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    const handler = (event) => {
      if (event.key === 'Escape') closeRef.current?.();
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.getClientRects().length);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => panelRef.current?.querySelector('button, input, select, textarea')?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      before?.focus?.();
    };
  }, [open, panelRef]);
}

function ModalHeader({ title, onClose, id }) {
  const { t } = useI18n();
  return <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><h2 id={id} className="text-lg font-bold text-ink">{title}</h2><IconButton aria-label={t('common.close')} onClick={onClose}><X className="h-5 w-5" /></IconButton></div>;
}

export function Dialog({ open, onClose, title, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useModal(open, onClose, panelRef);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return createPortal(<div className="fixed inset-0 z-[90] grid place-items-center bg-[var(--overlay)] p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`max-h-[90dvh] w-full overflow-hidden rounded-lg border border-border bg-surface shadow-3 ${widths[size]}`}><ModalHeader title={title} onClose={onClose} id={titleId} /><div className="max-h-[calc(90dvh-136px)] overflow-y-auto p-5">{children}</div>{footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}</div></div>, document.body);
}

export function Drawer({ open, onClose, title, children, width = 'max-w-xl', side = 'end' }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useModal(open, onClose, panelRef);
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[85] bg-[var(--overlay)]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`absolute inset-y-0 ${side === 'start' ? 'start-0' : 'end-0'} flex w-full ${width} flex-col border-s border-border bg-surface shadow-3`}><ModalHeader title={title} onClose={onClose} id={titleId} /><div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div></aside></div>, document.body);
}

export function Tooltip({ content, children }) {
  return <span className="group relative inline-flex"><span>{children}</span><span role="tooltip" className="pointer-events-none absolute bottom-full start-1/2 z-50 mb-2 hidden max-w-64 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-xs text-surface shadow-2 group-hover:block group-focus-within:block">{content}</span></span>;
}
