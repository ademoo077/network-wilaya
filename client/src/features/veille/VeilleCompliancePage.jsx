import { useState } from 'react';
import { ArrowRight, Eraser, FileCheck2, ShieldCheck, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '@anm/shared';
import { api } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Alert, Button, Card, Dialog, EmptyState, Input, useToast,
} from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

function DataList({ title, keys, t }) {
  return <div>
    <h3 className="text-sm font-bold text-ink">{title}</h3>
    <ul className="mt-1 grid list-disc gap-1 ps-5 text-sm text-muted">{keys.map((key) => <li key={key}>{t(`veille.compliance.${key}`)}</li>)}</ul>
  </div>;
}

export default function VeilleCompliancePage() {
  const { t } = useI18n(); const { user } = useAuth(); const { push } = useToast();
  const admin = user.role === 'admin';
  const query = useApiQuery('/veille/conformite');
  const item = query.data?.item;
  const [form, setForm] = useState({ id: '', url: '', motif: '' });
  const [confirm, setConfirm] = useState(null); const [busy, setBusy] = useState(false);

  const submitErase = (event) => {
    event.preventDefault();
    if (!form.id.trim() && !form.url.trim()) { push(t('veille.compliance.exactlyOne'), 'danger'); return; }
    setConfirm('erase');
  };
  const erase = async () => {
    setBusy(true);
    try {
      const body = { motif: form.motif.trim() || null };
      if (form.id.trim()) body.id = Number(form.id); else body.url = form.url.trim();
      const result = await api('/veille/effacement', { method: 'POST', body });
      push(t('veille.compliance.erased', { count: result.item.elements }), 'success');
      setForm({ id: '', url: '', motif: '' }); setConfirm(null); await query.refetch();
    } catch (cause) { push(cause.message, 'danger'); } finally { setBusy(false); }
  };
  const purge = async () => {
    setBusy(true);
    try {
      const result = await api('/veille/purge', { method: 'POST' });
      push(t('veille.compliance.purged', { deleted: result.item.supprimes || 0, anonymized: result.item.anonymises || 0 }), 'success');
      setConfirm(null); await query.refetch();
    } catch (cause) { push(cause.message, 'danger'); } finally { setBusy(false); }
  };

  return <div className="page-container">
    <PageHeader title={t('veille.compliance.title')} description={t('veille.compliance.subtitle')} />
    <QueryContent query={query}>
      {item && <>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><FileCheck2 className="h-4 w-4" aria-hidden="true" />{t('veille.compliance.registry')}</h2>
            <div className="grid gap-4">
              <div><h3 className="text-sm font-bold text-ink">{t('veille.compliance.finalite')}</h3><p className="text-sm text-muted">{t('veille.compliance.finaliteText')}</p></div>
              <div><h3 className="text-sm font-bold text-ink">{t('veille.compliance.baseLegale')}</h3><p className="text-sm text-muted">{t('veille.compliance.baseLegaleText')}</p></div>
              <DataList title={t('veille.compliance.categories')} t={t} keys={['category1', 'category2', 'category3', 'category4', 'category5']} />
              <DataList title={t('veille.compliance.durations')} t={t} keys={['duration1', 'duration2', 'duration3', 'duration4']} />
              <div><h3 className="text-sm font-bold text-ink">{t('veille.compliance.recipients')}</h3><p className="text-sm text-muted">{t('veille.compliance.recipientsText')}</p></div>
              <DataList title={t('veille.compliance.measures')} t={t} keys={['measure1', 'measure2', 'measure3', 'measure4', 'measure5']} />
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('veille.compliance.currentSettings')}</h2>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('veille.compliance.active')}</dt><dd className="font-semibold text-ink">{item.parametres.activee ? t('common.yes') : t('common.no')}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('veille.compliance.retentionDays')}</dt><dd className="font-semibold text-ink">{item.parametres.conservation_jours} {t('veille.dashboard.days')}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('veille.compliance.storeAuthor')}</dt><dd className="font-semibold text-ink">{item.parametres.stocker_auteur ? t('common.yes') : t('common.no')}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('veille.compliance.pseudonymize')}</dt><dd className="font-semibold text-ink">{item.parametres.pseudonymiser_auteurs ? t('common.yes') : t('common.no')}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('veille.compliance.geoFilter')}</dt><dd className="font-semibold text-ink">{t(`veille.settings.geo.${item.parametres.filtre_geo}`)}</dd></div>
              </dl>
              {admin && <Button className="mt-3" size="sm" variant="secondary" as={Link} to="/veille/reglages?tab=parametres">{t('veille.compliance.openSettings')}<ArrowRight className="ms-1 h-4 w-4" aria-hidden="true" /></Button>}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-bold text-ink">{t('veille.compliance.counters')}</h2>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[['elements', item.compteurs.elements], ['retained', item.compteurs.retenus], ['anonymized', item.compteurs.pseudonymes], ['expired', item.compteurs.echus], ['sources', item.compteurs.sources], ['decisions', item.compteurs.decisions]].map(([key, value]) => <div key={key} className="rounded-md border border-border p-2"><dt className="text-xs text-muted">{t(`veille.compliance.${key}`)}</dt><dd className="text-lg font-black text-ink">{value}</dd></div>)}
              </dl>
              <p className="mt-3 text-xs text-muted">{t('veille.compliance.lastPurge')} : {item.derniere_purge ? formatDateTime(item.derniere_purge) : t('veille.compliance.never')}</p>
              {admin && <Button className="mt-3" size="sm" variant="ghost" onClick={() => setConfirm('purge')}><Eraser className="h-4 w-4" aria-hidden="true" />{t('veille.compliance.purgeNow')}</Button>}
            </Card>
          </div>
        </div>

        <Card className="mt-4 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-ink"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('veille.compliance.charter')}</h2>
          <ol className="grid list-decimal gap-2 ps-5 text-sm text-muted">{[1, 2, 3, 4, 5].map((index) => <li key={index}>{t(`veille.compliance.charter${index}`)}</li>)}</ol>
          <p className="mt-3 text-xs text-muted">{t('veille.compliance.auditNote')}</p>
        </Card>

        {admin && <Card className="mt-4 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-ink"><Trash2 className="h-4 w-4" aria-hidden="true" />{t('veille.compliance.erasure')}</h2>
          <p className="mb-3 max-w-3xl text-sm text-muted">{t('veille.compliance.erasureHelp')}</p>
          <form onSubmit={submitErase} className="grid gap-3 sm:grid-cols-2">
            <Input label={t('veille.compliance.erasureId')} type="number" min="1" value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} />
            <Input label={t('veille.compliance.erasureUrl')} type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://..." />
            <Input className="sm:col-span-2" label={t('veille.compliance.erasureMotif')} maxLength={300} value={form.motif} onChange={(event) => setForm({ ...form, motif: event.target.value })} />
            <div className="sm:col-span-2"><Button type="submit" variant="secondary"><Trash2 className="h-4 w-4" aria-hidden="true" />{t('veille.compliance.erase')}</Button></div>
          </form>
          <Alert variant="warning" className="mt-3">{t('veille.compliance.eraseWarning')}</Alert>
        </Card>}
        {!item.compteurs.elements && <div className="mt-4"><EmptyState icon={FileCheck2} title={t('veille.compliance.empty')} /></div>}
      </>}
    </QueryContent>

    <Dialog open={confirm === 'erase'} onClose={() => setConfirm(null)} title={t('veille.compliance.eraseConfirmTitle')}
      footer={<>
        <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>{t('common.cancel')}</Button>
        <Button variant="secondary" onClick={erase} loading={busy}>{t('veille.compliance.erase')}</Button>
      </>}>
      <p className="text-sm text-muted">{t('veille.compliance.eraseConfirmBody')}</p>
    </Dialog>
    <Dialog open={confirm === 'purge'} onClose={() => setConfirm(null)} title={t('veille.compliance.purgeConfirmTitle')}
      footer={<>
        <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>{t('common.cancel')}</Button>
        <Button variant="secondary" onClick={purge} loading={busy}>{t('veille.compliance.purgeNow')}</Button>
      </>}>
      <p className="text-sm text-muted">{t('veille.compliance.purgeConfirmBody')}</p>
    </Dialog>
  </div>;
}
