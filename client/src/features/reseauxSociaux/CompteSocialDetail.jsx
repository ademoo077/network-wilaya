import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, GitMerge, Pencil, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { compteSocialActionResultSchema, formatDateTime, isSafeHttpUrl, normaliserCompteSocial } from '@anm/shared';
import { api } from '../../api/client.js';
import { Alert, Button, Drawer, EmptyState, PlatformBadge, useToast } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';
import { CompteSocialEtat, CompteSocialType, socialLocationLabel } from './CompteSocialBadges.jsx';
import CompteSocialHistory from './CompteSocialHistory.jsx';
import CompteSocialMergeDialog from './CompteSocialMergeDialog.jsx';

function DetailField({ label, children }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-ink">{children}</dd></div>;
}
export default function CompteSocialDetail({ id, onClose, onEdit, onChanged, canManage }) {
  const { t, lang } = useI18n(); const { push } = useToast(); const queryClient = useQueryClient();
  const query = useApiQuery(`/reseaux-sociaux/${id}`); const item = query.data?.item;
  const [busy, setBusy] = useState(false); const [merging, setMerging] = useState(false);
  const refresh = async () => { await queryClient.invalidateQueries({ predicate: ({ queryKey }) => String(queryKey[1]).startsWith('/reseaux-sociaux') }); await onChanged?.(); };
  const mutate = async (path, options, message) => {
    setBusy(true);
    try {
      const result = await api(path, { ...options, schema: compteSocialActionResultSchema, fallback: null });
      if (!result?.item) throw new Error(t('social.badResponse'));
      push(t(message)); await refresh();
      if (options.method === 'DELETE') onClose();
    } catch (cause) { push(cause.message || t('common.error')); }
    finally { setBusy(false); }
  };
  return <Drawer open title={t('social.detail')} onClose={onClose}>
    <QueryContent query={query}>
      {!item ? <EmptyState title={t('social.missingRecord')} /> : <div className="space-y-5">
        <div><h3 className="break-words text-xl font-black text-ink"><bdi>{item.nom || t('social.missingName')}</bdi></h3>
          <div className="mt-3 flex flex-wrap items-center gap-2"><PlatformBadge value={item.plateforme} /><CompteSocialType value={item.categorie} /></div>
          <div className="mt-3"><CompteSocialEtat item={item} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSafeHttpUrl(item.lien_url) && <Button as="a" href={item.lien_url} target="_blank" rel="noopener noreferrer" variant="secondary"><ExternalLink className="h-4 w-4" aria-hidden="true" />{t('social.openLink')}</Button>}
          {canManage && <Button onClick={() => onEdit(item)}><Pencil className="h-4 w-4" aria-hidden="true" />{t('social.edit')}</Button>}
          {canManage && !item.deleted_at && <Button variant="secondary" loading={busy}
            onClick={() => mutate(`/reseaux-sociaux/${item.id}/controle`, { method: 'POST', body: { verification: item.verification === 'verifie' ? 'a_verifier' : 'verifie', version: item.version } }, 'social.controlled')}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />{t(item.verification === 'verifie' ? 'social.controlUndo' : 'social.control')}</Button>}
          {canManage && !item.deleted_at && <Button variant="secondary" disabled={busy} onClick={() => setMerging(true)}>
            <GitMerge className="h-4 w-4" aria-hidden="true" />{t('social.merge.title')}</Button>}
          {canManage && <Button variant="ghost" loading={busy} onClick={() => mutate(item.deleted_at ? `/reseaux-sociaux/${item.id}/restaurer` : `/reseaux-sociaux/${item.id}`,
            { method: item.deleted_at ? 'POST' : 'DELETE' }, item.deleted_at ? 'social.restored' : 'social.trashed')}>
            {item.deleted_at ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            {t(item.deleted_at ? 'social.restore' : 'social.trash')}</Button>}
        </div>
        {(!item.commune_id || !item.nom) && <Alert variant="warning">{t('social.incompleteHelp')}</Alert>}
        {normaliserCompteSocial(item.lien_url).publication && <Alert variant="warning">{t('social.warning.lien_publication')}</Alert>}
        <dl className="grid gap-4 rounded-lg border border-border bg-surface2 p-4 sm:grid-cols-2">
          <DetailField label={t('social.ca')}><bdi>{socialLocationLabel(item, 'ca', lang)}</bdi></DetailField>
          <DetailField label={t('field.commune')}><bdi>{socialLocationLabel(item, 'commune', lang)}</bdi></DetailField>
          <DetailField label={t('social.origin')}>{t(`social.origin.${item.origine}`)}</DetailField>
          <DetailField label={t('social.updatedAt')}><bdi>{formatDateTime(item.updated_at)}</bdi></DetailField>
        </dl>
        <div><h4 className="mb-2 text-sm font-bold">{t('social.link')}</h4><p className="rounded-md border border-border p-3 text-xs text-ink2"><bdi dir="ltr" className="break-all">{item.lien_url}</bdi></p></div>
        <div><h4 className="mb-2 text-sm font-bold">{t('social.observations')}</h4><p className="whitespace-pre-wrap break-words text-sm text-ink2"><bdi>{item.observations || t('social.noObservations')}</bdi></p></div>
        {item.origine === 'excel' && <div className="rounded-lg border border-border p-4">
          <h4 className="text-sm font-bold">{t('social.sourceTrace')}</h4><p className="mt-1 text-xs text-muted">{t('social.sourceTraceHelp')}</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailField label={t('social.sourceFile')}><bdi>{item.fichier_source}</bdi></DetailField>
            <DetailField label={t('social.sourceRow')}><bdi>{item.feuille_source} · {item.ligne_source}:{item.colonne_source}</bdi></DetailField>
            <DetailField label={t('social.caSource')}><bdi>{item.ca_source || '—'}</bdi></DetailField>
            <DetailField label={t('social.communeSource')}><bdi>{item.commune_source || '—'}</bdi></DetailField>
            <DetailField label={t('social.nameSource')}><bdi>{item.nom_source || t('social.missingName')}</bdi></DetailField>
          </dl>
        </div>}
        <CompteSocialHistory id={id} />
      </div>}
    </QueryContent>
    {merging && item && <CompteSocialMergeDialog source={item} onClose={() => setMerging(false)} onChanged={refresh} />}
  </Drawer>;
}
