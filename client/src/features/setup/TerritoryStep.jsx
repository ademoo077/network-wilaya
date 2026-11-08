import { useState } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client.js';
import { Alert, Button, Card, Textarea, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function TerritoryStep({ onApplied }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async (dryRun) => {
    setLoading(true);
    try {
      const result = await api('/ref/bulk-territoire', { method: 'POST', body: { texte: text, dryRun } });
      setPreview(result.item);
      if (!dryRun) { push(t('common.success')); await onApplied?.(); }
    } catch (error) {
      push(error.message, 'danger');
    } finally { setLoading(false); }
  };
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><Card className="p-5"><Textarea label={t('setup.territory')} hint={t('setup.territoryHelp')} maxLength={200000} rows={12} value={text} onChange={(event) => { setText(event.target.value); setPreview(null); }} placeholder="Daïra A ; Commune A&#10;Daïra B : Commune B, Commune C" /><div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" loading={loading} disabled={!text.trim()} onClick={() => run(true)}>{t('setup.preview')}</Button><Button loading={loading} disabled={!preview?.dairas?.length || preview?.invalides?.length > 0} onClick={() => run(false)}>{t('setup.apply')}</Button></div></Card><Card className="p-5"><h3 className="flex items-center gap-2 font-bold"><Building2 className="h-5 w-5 text-brand-700" />{t('setup.preview')}</h3>{!preview ? <p className="mt-4 text-sm text-muted">{t('common.noData')}</p> : <div className="mt-4 space-y-4"><div className="grid grid-cols-2 gap-3"><Metric label={t('admin.dairas')} value={preview.totals?.dairas} /><Metric label={t('admin.communes')} value={preview.totals?.communes} /></div>{preview.invalides?.length > 0 && <Alert variant="danger" title={`${t('setup.invalidLines')} (${preview.invalides.length})`}>{preview.invalides.slice(0, 5).map((item) => <p key={item.ligne}>{item.ligne} — {item.motif}</p>)}</Alert>}{preview.doublons?.length > 0 && <Alert variant="warning" title={`${t('setup.duplicates')} (${preview.doublons.length})`}>{preview.doublons.slice(0, 5).map((item, index) => <p key={`${item.daira}-${item.commune}-${index}`}><bdi>{item.daira} · {item.commune}</bdi></p>)}</Alert>}{!preview.invalides?.length && <Alert variant="success"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{t('common.success')}</span></Alert>}</div>}</Card></div>;
}

function Metric({ label, value }) {
  return <div className="rounded-md bg-surface2 p-3 text-center"><p className="text-2xl font-black text-ink">{value || 0}</p><p className="text-xs text-muted">{label}</p></div>;
}
