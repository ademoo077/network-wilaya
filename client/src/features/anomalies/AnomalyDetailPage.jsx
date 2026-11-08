import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, MapPinned, Pencil, RotateCcw, Trash2, Upload } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatDateTime, formatGps } from '@anm/shared';
import { api } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, LoadingBlock, PlatformBadge, PriorityBadge, StatusBadge, VerificationBadge, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useI18n } from '../../i18n/index.jsx';
import MiniMap from '../map/MiniMap.jsx';
import AnomalyActionDialog from './AnomalyActionDialog.jsx';
import { anomalyLabel, historyLabel } from './helpers.js';

export default function AnomalyDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { refs } = useRefs();
  const { push } = useToast();
  const navigate = useNavigate();
  const [action, setAction] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
  const upload = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const body = new FormData(); body.append('file', file);
    try { await api(`/anomalies/${id}/pieces`, { method: 'POST', body }); push(t('common.success')); await reload(); } catch (requestError) { push(requestError.message, 'danger'); }
  };
  const removePiece = async (pieceId) => { try { await api(`/pieces/${pieceId}`, { method: 'DELETE' }); await reload(); } catch (requestError) { push(requestError.message, 'danger'); } };
  const remove = async () => { try { await api(`/anomalies/${id}`, { method: 'DELETE', body: {} }); push(t('common.success')); navigate('/anomalies'); } catch (requestError) { push(requestError.message, 'danger'); } };
  return <div className="page-container"><PageHeader title={item.reference} description={`${anomalyLabel(item, 'type', lang)} · ${formatDate(item.date_signalement)}`} actions={<>{writable && <Button variant="secondary" as={Link} to={`/anomalies/${id}/modifier`}><Pencil className="h-4 w-4" />{t('common.edit')}</Button>}{user.role === 'admin' && <Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" />{t('common.delete')}</Button>}</>} /><div className="mb-5 flex flex-wrap gap-2"><StatusBadge value={item.statut} /><VerificationBadge value={item.verification} /><PriorityBadge value={item.priorite} /><PlatformBadge value={item.plateforme} /></div>{item.repetitions_count > 1 && <p className="mb-3 text-sm font-semibold text-ink2">{t('form.repetitions', { count: item.repetitions_count })}</p>}{writable && <Card className="mb-5"><CardHeader title={t('detail.quickActions')} /><div className="flex flex-wrap gap-2 p-4">{item.verification !== 'confirmee' && <Button size="sm" onClick={() => setAction('confirm')}><CheckCircle2 className="h-4 w-4" />{t('detail.confirm')}</Button>}{item.verification !== 'infirmee' && <Button size="sm" variant="secondary" onClick={() => setAction('deny')}>{t('detail.deny')}</Button>}{item.statut === 'non_traite' && <Button size="sm" variant="secondary" onClick={() => setAction('progress')}>{t('detail.markProgress')}</Button>}{item.statut !== 'traite' && <Button size="sm" variant="secondary" onClick={() => setAction('done')}>{t('detail.markDone')}</Button>}{item.statut === 'traite' && <Button size="sm" variant="secondary" onClick={() => setAction('reopen')}><RotateCcw className="h-4 w-4" />{t('detail.reopen')}</Button>}{item.gps && <Button size="sm" variant="ghost" as="a" href={`https://www.google.com/maps/dir/?api=1&destination=${item.gps.lat},${item.gps.lng}`} target="_blank" rel="noopener noreferrer"><MapPinned className="h-4 w-4" />{t('form.openMaps')}</Button>}<Button size="sm" variant="ghost" onClick={copyEpic}><Copy className="h-4 w-4" />{t('common.copy')}</Button></div></Card>}<div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)]"><div className="space-y-5"><Card><CardHeader title={t('detail.information')} /><dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"><Field label={t('field.category')} value={anomalyLabel(item, 'domaine', lang)} /><Field label={t('field.type')} value={anomalyLabel(item, 'type', lang)} /><Field label={t('field.daira')} value={anomalyLabel(item, 'daira', lang)} /><Field label={t('field.commune')} value={anomalyLabel(item, 'commune', lang)} /><Field label={t('field.address')} value={item.adresse_texte} /><Field label={t('field.place')} value={item.lieu_dit} /><Field label={t('field.agent')} value={item.agent_nom} /><Field label={t('field.epic')} value={item.epic_name || item.intervenant_autre} /><Field label={t('field.verificationDate')} value={formatDate(item.date_verification)} /><Field label={t('field.interventionDate')} value={formatDate(item.date_intervention)} /><Field label={t('field.treatmentDate')} value={formatDate(item.date_traitement)} /><Field label={t('field.gps')} value={item.gps ? formatGps(item.gps.lat, item.gps.lng) : null} /></dl>{item.observations && <div className="border-t border-border p-5"><p className="text-xs font-bold text-muted">{t('field.observations')}</p><p className="mt-2 whitespace-pre-wrap text-sm"><bdi>{item.observations}</bdi></p></div>}<div className="border-t border-border p-5"><a className="inline-flex items-center gap-2 break-all text-sm font-bold text-brand-700 hover:underline" href={item.lien_url_sur} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 shrink-0" /><bdi>{item.lien_url}</bdi></a></div></Card><Card><CardHeader title={t('form.attachments')} action={writable && <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-brand-700 px-4 text-sm font-bold text-brand-50"><Upload className="h-4 w-4" />{t('common.add')}<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={upload} /></label>} /><div className="grid gap-3 p-5 sm:grid-cols-2">{data.pieces.length ? data.pieces.map((piece) => <div key={piece.id} className="flex items-center justify-between gap-2 rounded-md bg-surface2 p-3"><a href={`/api/pieces/${piece.id}/file`} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-bold text-brand-700"><bdi>{piece.nom_original}</bdi></a>{writable && <Button size="sm" variant="ghost" onClick={() => removePiece(piece.id)}>{t('common.delete')}</Button>}</div>) : <p className="text-sm text-muted">{t('common.noData')}</p>}</div></Card></div><div className="space-y-5">{item.gps && <Card className="p-3"><MiniMap value={item.gps} tileUrl={refs.parametres.tile_url} interactive={false} /></Card>}<Card><CardHeader title={t('detail.timeline')} /><ol className="p-5">{data.history.length ? data.history.map((entry) => <li key={entry.id} className="relative border-s border-border pb-5 ps-5 last:pb-0 before:absolute before:-start-1.5 before:top-1 before:h-3 before:w-3 before:rounded-full before:bg-brand-600"><p className="text-sm font-bold">{historyLabel(entry.champ, t)}</p><p className="mt-1 text-xs text-muted"><bdi>{entry.ancienne_valeur || '—'}</bdi> → <bdi>{entry.nouvelle_valeur || '—'}</bdi></p>{entry.motif && <p className="mt-1 text-xs text-ink2"><bdi>{entry.motif}</bdi></p>}<p className="mt-1 text-[11px] text-muted"><bdi>{entry.user_nom || entry.user_username || '—'}</bdi> · {formatDateTime(entry.at)}</p></li>) : <EmptyState title={t('detail.noHistory')} compact />}</ol></Card></div></div><AnomalyActionDialog action={action} item={item} onClose={() => setAction(null)} onDone={reload} /><Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('common.delete')} footer={<><Button variant="ghost" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={remove}>{t('common.delete')}</Button></>}><Alert variant="danger">{t('detail.deleteQuestion')}</Alert></Dialog></div>;
}

function Field({ label, value }) {
  return <div><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold"><bdi>{value || '—'}</bdi></dd></div>;
}
