import { useState } from 'react';
import { BookmarkPlus, Check, Globe2, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Button, IconButton, Input, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

const TECHNICAL = ['page', 'pageSize', 'sort', 'dir'];

function currentFilters(filters) {
  return Object.fromEntries(Object.entries(filters)
    .filter(([key, value]) => value && !TECHNICAL.includes(key)));
}

function sameFilters(left, right) {
  const a = currentFilters(left); const b = currentFilters(right);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => String(a[key] ?? '') === String(b[key] ?? ''));
}

/**
 * Vues enregistrées par utilisateur (partageables par l'administrateur).
 * L'application d'une vue remplace tous les filtres de la liste, page remise à 1.
 */
export default function SavedViews({ filters, apply }) {
  const { t } = useI18n(); const { user } = useAuth(); const { push } = useToast();
  const client = useQueryClient(); const query = useApiQuery('/views');
  const views = query.data?.items || []; const writable = user.role !== 'lecteur';
  const [open, setOpen] = useState(false); const [nom, setNom] = useState(''); const [partagee, setPartagee] = useState(false);
  const invalidate = () => client.invalidateQueries({ queryKey: ['api', '/views'] });
  const create = useMutation({
    mutationFn: () => api('/views', { method: 'POST', body: { nom: nom.trim(), filtres: currentFilters(filters), partagee } }),
    onSuccess: (payload) => { push(t('views.saved', { name: payload.item.nom })); setNom(''); setPartagee(false); setOpen(false); invalidate(); },
    onError: (error) => {
      const known = { VUE_EXISTE: 'views.exists', VUE_LIMITE: 'views.limit' };
      push(known[error.code] ? t(known[error.code]) : error.message, 'danger');
    },
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/views/${id}`, { method: 'DELETE' }),
    onSuccess: () => { push(t('views.removed')); invalidate(); },
    onError: (error) => push(error.message, 'danger'),
  });
  return <section aria-label={t('views.title')} className="mb-3 min-w-0">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{t('views.title')}</span>
      {views.map((view) => {
        const active = sameFilters(filters, view.filtres);
        return <span key={view.id} className={`inline-flex min-h-11 items-center rounded-full border ${active ? 'border-brand-700 bg-brand-100' : 'border-border bg-surface'}`}>
          <button type="button" aria-pressed={active} aria-label={t('views.apply', { name: view.nom })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
            onClick={() => apply({ ...view.filtres, page: 1 })}>
            {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}<bdi>{view.nom}</bdi>
            {view.partagee && <Globe2 className="h-3.5 w-3.5 text-brand-700" aria-label={t('views.shared')} />}
          </button>
          {view.own && <IconButton aria-label={t('views.delete', { name: view.nom })} disabled={remove.isPending}
            className="me-1 min-h-8 w-8" onClick={() => remove.mutate(view.id)}><Trash2 className="h-3.5 w-3.5" /></IconButton>}
        </span>;
      })}
      {writable && <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
        <BookmarkPlus className="h-4 w-4" />{t('views.save')}</Button>}
    </div>
    {views.length === 0 && !query.isPending && <p className="mt-1 text-xs text-muted">{t('views.empty')}</p>}
    {open && <form className="mt-3 grid max-w-xl gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-[1fr_auto]"
      onSubmit={(event) => { event.preventDefault(); if (nom.trim()) create.mutate(); }}>
      <Input label={t('views.name')} value={nom} onChange={(event) => setNom(event.target.value)}
        placeholder={t('views.namePlaceholder')} maxLength={60} required />
      <div className="flex flex-wrap items-center gap-3 sm:items-end">
        {user.role === 'admin' && <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={partagee} onChange={(event) => setPartagee(event.target.checked)} />{t('views.share')}</label>}
        <Button type="submit" loading={create.isPending} disabled={!nom.trim()}>{t('common.save')}</Button>
      </div>
    </form>}
  </section>;
}
