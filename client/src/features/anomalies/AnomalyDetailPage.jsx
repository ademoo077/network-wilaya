import { useState } from 'react';
import { Ban, Copy, ExternalLink, MapPinned, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estSansSuite, formatDate } from '@anm/shared';
import { api } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Card, CardHeader, Dialog, ErrorState, LoadingBlock, PlatformBadge, PriorityBadge, StatusBadge, Textarea, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useI18n } from '../../i18n/index.jsx';
import AnomalyActionDialog from './AnomalyActionDialog.jsx';
import PhotoPanel from './photos/PhotoPanel.jsx';
import { anomalyLabel } from './helpers.js';
import HistoryTimeline from './HistoryTimeline.jsx';
import DetailContextCards from './DetailContextCards.jsx';

export default function AnomalyDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { refs } = useRefs();
  const { push } = useToast();
  const navigate = useNavigate();
  const [action, setAction] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sansSuiteOpen, setSansSuiteOpen] = useState(false);
  const [sansSuiteMotif, setSansSuiteMotif] = useState('');
  const [sansSuiteBusy, setSansSuiteBusy] = useState(false);
  const { data, loading, error, reload } = useFetch(async () => {
    const [detail, history, pieces] = await Promise.all([api(`/anomalies/${id}`), api(`/anomalies/${id}/historique`), api(`/anomalies/${id}/pieces`)]);
    return { item: detail.item, history: history.items, pieces: pieces.items };
  }, [id]);
  if (loading) return <div className="page-container"><LoadingBlock /></div>;
  if (error) return <div className="page-container"><ErrorState message={error.message} onRetry={reload} /></div>;
  const item = data.item;
  const writable = user.role !== 'lecteur';
  const copyEpic = async () => {
    const gps = item.gps ? `https://www.google.com/maps?q=${item.gps.lat},${item.gps.lng}` : '—';
    const text = `${item.reference}\n${anomalyLabel(item, 'domaine', lang)} › ${anomalyLabel(item, 'type', lang)}\n${anomalyLabel(item, 'commune', lang)} / ${anomalyLabel(item, 'daira', lang)}\n${gps}\n${item.lien_url}\n${t(`priority.${item.priorite}`)}`;
    await navigator.clipboard.writeText(text); push(t('common.copied'));
  };
  const remove = async () => { try { await api(`/anomalies/${id}`, { method: 'DELETE', body: {} }); push(t('common.success')); navigate('/anomalies'); } catch (requestError) { push(requestError.message, 'danger'); } };
  const markSansSuite = async (event) => {
    event.preventDefault();
    setSansSuiteBusy(true);
    try {
      await api(`/anomalies/${id}/sans-suite`, { method: 'POST', body: { version: item.version, motif: sansSuiteMotif } });
      push(t('detail.sansSuiteDone')); setSansSuiteOpen(false); setSansSuiteMotif(''); await reload();
    } catch (requestError) { push(requestError.message, 'danger'); } finally { setSansSuiteBusy(false); }
  };
  return <div className="page-container"><PageHeader title={item.reference} description={`${anomalyLabel(item, 'type', lang)} · ${formatDate(item.date_signalement)}`} actions={<>{writable && <Button variant="secondary" as={Link} to={`/anomalies/${id}/modifier`}><Pencil className="h-4 w-4" />{t('common.edit')}</Button>}{user.role === 'admin' && <Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" />{t('common.delete')}</Button>}</>} /><div className="mb-5 flex flex-wrap gap-2"><StatusBadge value={item.statut} />{estSansSuite(item) && <span className="inline-flex items-center gap-1 rounded-sm bg-stnonbg px-2 py-0.5 text-xs font-semibold text-stnon">{t('detail.sansSuite')}</span>}<PriorityBadge value={item.priorite} /><PlatformBadge value={item.plateforme} /></div>{item.repetitions_count > 1 && <p className="mb-3 text-sm font-semibold text-ink2">{t('form.repetitions', { count: item.repetitions_count })}</p>}{writable && <Card className="mb-5"><CardHeader title={t('detail.quickActions')} /><div className="flex flex-wrap gap-2 p-4">{!estSansSuite(item) && <Button size="sm" variant="secondary" onClick={() => setSansSuiteOpen(true)}><Ban className="h-4 w-4" />{t('detail.sansSuite')}</Button>}{item.statut === 'non_traite' && <Button size="sm" variant="secondary" onClick={() => setAction('progress')}>{t('detail.markProgress')}</Button>}{item.statut !== 'traite' && <Button size="sm" variant="secondary" onClick={() => setAction('done')}>{t('detail.markDone')}</Button>}{item.statut === 'traite' && user.role === 'admin' && <Button size="sm" variant="secondary" onClick={() => setAction('correct')}><RotateCcw className="h-4 w-4" />{t('detail.correctError')}</Button>}{item.gps && <Button size="sm" variant="ghost" as="a" href={`https://www.google.com/maps/dir/?api=1&destination=${item.gps.lat},${item.gps.lng}`} target="_blank" rel="noopener noreferrer"><MapPinned className="h-4 w-4" />{t('form.openMaps')}</Button>}<Button size="sm" variant="ghost" onClick={copyEpic}><Copy className="h-4 w-4" />{t('common.copy')}</Button></div></Card>}<div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)]"><div className="space-y-5"><Card><CardHeader title={t('detail.information')} /><dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"><Field label={t('field.category')} value={anomalyLabel(item, 'domaine', lang)} /><Field label={t('field.type')} value={anomalyLabel(item, 'type', lang)} /><Field label={t('field.daira')} value={anomalyLabel(item, 'daira', lang)} /><Field label={t('field.commune')} value={anomalyLabel(item, 'commune', lang)} />{item.source_nom && <Field label={t('v14.source.label')} value={`${item.source_nom}${item.source_plateforme ? ` · ${t(`platform.${item.source_plateforme}`)}` : ''}`} />}<Field label={t('field.address')} value={item.adresse_texte} /><Field label={t('field.place')} value={item.lieu_dit} /><Field label={t('field.epic')} value={item.epic_name || item.intervenant_autre} /><Field label={t('field.interventionDate')} value={formatDate(item.date_intervention)} /><Field label={t('field.treatmentDate')} value={formatDate(item.date_traitement)} /></dl>{item.observations && <div className="border-t border-border p-5"><p className="text-xs font-bold text-muted">{t('field.observations')}</p><p className="mt-2 whitespace-pre-wrap text-sm"><bdi>{item.observations}</bdi></p></div>}<div className="border-t border-border p-5"><a className="inline-flex items-center gap-2 break-all text-sm font-bold text-brand-700 hover:underline" href={item.lien_url_sur} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 shrink-0" /><bdi>{item.lien_url}</bdi></a></div></Card><PhotoPanel anomalieId={item.id} pieces={data.pieces} sansPhotoMotif={item.sans_photo_motif} writable={writable} onReload={reload} /></div><div className="space-y-5 xl:sticky xl:top-4 xl:self-start"><DetailContextCards item={item} agents={refs.agents || []} tiles={refs.parametres?.tile_url} writable={writable} onReload={reload} /><Card><CardHeader title={t('detail.timeline')} /><HistoryTimeline entries={data.history} /></Card></div></div><AnomalyActionDialog action={action} item={item} pieces={data.pieces} onClose={() => setAction(null)} onDone={reload} /><Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('common.delete')} footer={<><Button variant="ghost" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={remove}>{t('common.delete')}</Button></>}><Alert variant="danger">{t('detail.deleteQuestion')}</Alert></Dialog><Dialog open={sansSuiteOpen} onClose={() => setSansSuiteOpen(false)} title={t('detail.sansSuite')} footer={<><Button variant="ghost" disabled={sansSuiteBusy} onClick={() => setSansSuiteOpen(false)}>{t('common.cancel')}</Button><Button type="submit" form="sans-suite-form" variant="danger" loading={sansSuiteBusy} disabled={!sansSuiteMotif.trim()}>{t('common.confirm')}</Button></>}><form id="sans-suite-form" onSubmit={markSansSuite} className="space-y-4"><p className="text-sm text-ink2">{t('detail.sansSuiteHelp')}</p><Textarea label={t('field.reason')} required maxLength={1000} value={sansSuiteMotif} onChange={(event) => setSansSuiteMotif(event.target.value)} /></form></Dialog></div>;
}

function Field({ label, value }) {
  return <div><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold"><bdi>{value || '—'}</bdi></dd></div>;
}
