import { useCallback, useEffect, useMemo, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { compteSocialItemSchema } from '@anm/shared';
import { api } from '../../api/client.js';
import { Alert, Button, Card, PlatformBadge, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { CompteSocialEtat, CompteSocialType } from './CompteSocialBadges.jsx';

const ACTIONS = { p: 'page', r: 'profil', g: 'groupe', c: 'chaine' };
const KEYS = ['p', 'r', 'g', 'c', 'i'];

/** File de qualification : raccourcis clavier, annulation et audit via l'API habituelle. */
export default function QualificationQueue({ query, canManage, onChanged, onOpen }) {
  const { t } = useI18n(); const { push } = useToast();
  const [busy, setBusy] = useState(null); const [history, setHistory] = useState([]);
  const items = useMemo(() => query.data?.items || [], [query.data?.items]);

  const send = useCallback(async (item, patch) => {
    const result = await api(`/reseaux-sociaux/${item.id}`, { method: 'PATCH', body: { version: item.version, ...patch },
      schema: compteSocialItemSchema, fallback: null });
    if (!result?.item) throw new Error(t('social.badResponse'));
    return result.item;
  }, [t]);

  const apply = useCallback(async (item, key) => {
    if (!canManage || busy) return;
    const ignored = key === 'i';
    const patch = ignored
      ? { categorie: item.categorie, verification: 'verifie', actif: 0 }
      : { categorie: ACTIONS[key], verification: 'verifie', actif: 1 };
    setBusy(item.id);
    try {
      const after = await send(item, patch);
      setHistory((previous) => [...previous.slice(-49), { before: item, after }]);
      push(t(ignored ? 'social.qualify.ignored' : 'social.qualify.done'));
      await onChanged(); await query.refetch();
    } catch (cause) { push(cause.message); }
    finally { setBusy(null); }
  }, [busy, canManage, onChanged, push, query, send, t]);

  const undoLast = useCallback(async () => {
    if (!canManage || busy || !history.length) return;
    const last = history[history.length - 1];
    setBusy(last.after.id);
    try {
      await send(last.after, { categorie: last.before.categorie, verification: last.before.verification, actif: last.before.actif });
      setHistory((previous) => previous.slice(0, -1));
      push(t('social.qualify.done'));
      await onChanged(); await query.refetch();
    } catch (cause) { push(cause.message); }
    finally { setBusy(null); }
  }, [busy, canManage, history, onChanged, push, query, send, t]);

  useEffect(() => {
    if (!canManage || busy) return undefined;
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('[role="dialog"]')) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key === 'z') { event.preventDefault(); undoLast(); return; }
      if (!KEYS.includes(key) || !items.length) return;
      event.preventDefault(); apply(items[0], key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [apply, busy, canManage, items, undoLast]);

  if (!canManage) return <Alert variant="info">{t('social.qualify.readOnly')}</Alert>;
  return <Card className="space-y-3 p-4" data-qualify-queue>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="text-lg font-black">{t('social.qualify.title')}</h3>
        <p className="mt-1 text-sm text-muted">{t('social.qualify.help')}</p></div>
      <Button variant="secondary" disabled={!history.length || !!busy} onClick={undoLast}>
        <Undo2 className="h-4 w-4" aria-hidden="true" />{t('social.qualify.undo')}</Button>
    </div>
    {!items.length && <p role="status" className="text-sm text-ink2">{t('social.qualify.empty')}</p>}
    <ul className="space-y-2" role="list">
      {items.map((item) => <li key={item.id} className="rounded-md border border-border bg-surface2 p-3" data-qualify-item={item.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><button type="button" className="text-left text-sm font-bold underline-offset-2 hover:underline" onClick={() => onOpen(item.id)}>
            <bdi>{item.nom || t('social.missingName')}</bdi></button>
            <div className="mt-1 flex flex-wrap items-center gap-2"><PlatformBadge value={item.plateforme} /><CompteSocialType value={item.categorie} /><CompteSocialEtat item={item} /></div>
            <p className="mt-1 break-all text-xs text-muted"><bdi>{item.lien_url}</bdi></p></div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('social.qualify.title')}>
            {KEYS.map((key) => <Button key={key} size="sm" variant={key === 'i' ? 'ghost' : 'secondary'} loading={busy === item.id}
              aria-label={t(`social.qualify.action.${key === 'i' ? 'ignorer' : ACTIONS[key]}`)}
              onClick={() => apply(item, key)}>{key.toUpperCase()}</Button>)}
          </div>
        </div>
      </li>)}
    </ul>
  </Card>;
}
