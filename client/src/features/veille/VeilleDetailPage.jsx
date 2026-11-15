import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, ExternalLink, MapPin, MessageSquare, RotateCcw, Shield, X,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@anm/shared';
import { api } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Card, CardHeader, EmptyState, PriorityBadge, useToast } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';
import HighlightedText from './HighlightedText.jsx';

const REASONS = ['hors_sujet', 'doublon', 'publicite', 'injure', 'autre'];
const STATUS_KEYS = { a_qualifier: 'aQualifier', retenu: 'retenus', rejete: 'rejetes', ignore: 'ignores', nouveau: 'aQualifier', doublon: 'rejetes' };

function parse(value, fallback = []) { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function reasonText(line, t) {
  if (typeof line === 'string') return line;
  if (!line || typeof line !== 'object') return '';
  return [line.terme, line.role ? t(`veille.role.${line.role}`) : null, line.occurrences ? `${line.occurrences} ×` : null].filter(Boolean).join(' · ');
}
function when(value) { return value ? (String(value).length > 10 ? formatDateTime(value) : formatDate(value)) : '—'; }

export default function VeilleDetailPage() {
  const { id } = useParams(); const { t, lang } = useI18n(); const { user } = useAuth(); const { push } = useToast();
  const query = useApiQuery(`/veille/elements/${id}`); const item = query.data?.item;
  const [busy, setBusy] = useState(false); const [reason, setReason] = useState('hors_sujet'); const [prefill, setPrefill] = useState(false);
  const writable = user.role !== 'lecteur';
  const act = async (kind) => {
    setBusy(true);
    try {
      const response = await api(`/veille/elements/${id}/${kind}`, { method: 'POST', body: kind === 'retenir' ? {} : { raison: reason } });
      if (kind === 'retenir' && response.prefill) setPrefill(true);
      push(t(kind === 'retenir' ? 'veille.toast.retained' : kind === 'rejeter' ? 'veille.toast.rejected' : 'veille.toast.undone'), 'success');
      await query.refetch();
    } catch (cause) { push(cause.message || t('veille.toast.error'), 'danger'); } finally { setBusy(false); }
  };
  return <div className="page-container">
    <PageHeader eyebrow={t('veille.title')} title={item?.page_nom || t('veille.detail.title')}
      description={item ? `${t('veille.detail.source')} · ${item.source_nom}` : undefined}
      actions={<><Button as={Link} to="/veille" variant="secondary"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('veille.detail.back')}</Button>
        {writable && item && <Button as={Link} to={`/anomalies/nouvelle?veille=${item.id}`}><ArrowRight className="h-4 w-4" aria-hidden="true" />{t('veille.edit')}</Button>}</>} />
    <QueryContent query={query}>{!item ? <EmptyState icon={MessageSquare} title={t('common.notFound')} /> : <>
      {prefill && <Alert variant="success" title={t('veille.prefillReady')} className="mb-4" action={<Button size="sm" as={Link} to={`/anomalies/nouvelle?veille=${item.id}`}>{t('veille.createAnomaly')}</Button>} />}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid gap-4">
          <Card>
            <CardHeader title={t('veille.detail.originalText')} description={item.url || undefined} action={<div className="flex items-center gap-2"><PriorityBadge value={item.priorite} /><span className="rounded-full bg-surface2 px-2 py-1 text-xs font-bold text-ink2">{t(`veille.tabs.${STATUS_KEYS[item.statut] || 'aQualifier'}`)}</span></div>} />
            <div className="p-5"><HighlightedText text={item.texte} terms={(item.correspondances || []).map((match) => match.terme)} className="whitespace-pre-wrap text-base leading-relaxed text-ink" />
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted"><span>{t('veille.date')} {when(item.date_publication)}</span><span>{t('veille.detail.collected')} {when(item.collecte_le)}</span>
                {item.commune_nom && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{item.commune_nom}</span>}
                {item.url && <a className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" href={item.url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{t('veille.detail.source')}</a>}
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title={t('veille.detail.suggestions')} description={t('veille.detail.why')} />
            <div className="p-5">{item.suggestions?.length ? <ul className="grid gap-3">{item.suggestions.map((suggestion) => <li key={suggestion.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-ink"><bdi>{lang === 'ar' ? suggestion.groupe_nom : suggestion.groupe_nom || suggestion.domaine_nom || '—'}</bdi></p><span className="text-xs font-semibold text-muted">#{suggestion.rang} · {t('veille.score')} {suggestion.score}</span></div>
              <p className="mt-1 text-sm text-ink2"><bdi>{[suggestion.groupe_nom, suggestion.domaine_nom, suggestion.type_nom].filter(Boolean).join(' · ')}</bdi></p>
              {parse(suggestion.raisons_json).length > 0 && <ul className="mt-2 grid gap-1 text-xs text-muted">{parse(suggestion.raisons_json).map((line, index) => <li key={`${suggestion.id}-${index}`}>· {reasonText(line, t)}</li>)}</ul>}
              {writable && <Button size="sm" variant="secondary" className="mt-3" as={Link} to={`/anomalies/nouvelle?veille=${item.id}`}>{t('veille.createAnomaly')}</Button>}
            </li>)}</ul> : <p className="text-sm text-muted">{t('veille.noSuggestion')}</p>}</div>
          </Card>
          <Card>
            <CardHeader title={t('veille.matchedTerms')} description={item.termes || undefined} />
            <div className="p-5">{item.correspondances?.length ? <div className="flex flex-wrap gap-2">{item.correspondances.map((match) => <span key={match.id} className="rounded-full border border-border bg-surface2 px-3 py-1.5 text-xs text-ink2"><bdi>{match.terme}</bdi> · {t(`veille.role.${match.role}`)} · {match.occurrences} × · {match.poids_total}</span>)}</div> : <p className="text-sm text-muted">{t('veille.noMatch')}</p>}</div>
          </Card>
          <Card>
            <CardHeader title={t('veille.detail.decisions')} />
            <div className="p-5">{item.decisions?.length ? <ol className="grid gap-3">{item.decisions.map((decision) => <li key={decision.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-ink">{decision.action}{decision.annule_le ? ` · ${t('veille.undo')}` : ''}</strong><span className="text-xs text-muted">{formatDateTime(decision.at)} · {decision.user_nom || '—'}</span></div>
              <p className="mt-1 text-xs text-muted">{parse(decision.apres_json, {}).raison || parse(decision.apres_json, {}).commentaire || ''}</p>
            </li>)}</ol> : <p className="text-sm text-muted">{t('veille.detail.noDecision')}</p>}</div>
          </Card>
        </div>
        <aside className="grid content-start gap-4">
          <Card><CardHeader title={t('veille.detail.actions')} /><div className="grid gap-2 p-4">
            {writable ? <>
              <Button loading={busy} onClick={() => act('retenir')}><Check className="h-4 w-4" aria-hidden="true" />{t('veille.retain')}</Button>
              <label className="text-xs font-semibold text-muted">{t('veille.rejectReason')}<select className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)}>{REASONS.map((value) => <option key={value} value={value}>{t(`veille.reason.${value}`)}</option>)}</select></label>
              <Button variant="ghost" loading={busy} onClick={() => act('rejeter')}><X className="h-4 w-4" aria-hidden="true" />{t('veille.reject')}</Button>
              <Button variant="ghost" loading={busy} onClick={() => act('annuler')}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('veille.undo')}</Button>
              <Button variant="secondary" as={Link} to={`/anomalies/nouvelle?veille=${item.id}`}>{t('veille.edit')}</Button>
            </> : <p className="text-sm text-muted">{t('common.readOnly')}</p>}
          </div></Card>
          <Card><CardHeader title={t('veille.detail.source')} /><dl className="grid gap-3 p-4 text-sm">
            <div><dt className="text-xs font-semibold text-muted">{t('veille.detail.page')}</dt><dd className="break-words text-ink"><bdi>{item.page_nom || '—'}</bdi></dd></div>
            <div><dt className="text-xs font-semibold text-muted">{t('veille.detail.source')}</dt><dd className="text-ink"><bdi>{item.source_nom || '—'}</bdi></dd></div>
            <div><dt className="text-xs font-semibold text-muted">{t('veille.lexicon.language')}</dt><dd className="text-ink">{t(`veille.langue.${item.langue || 'mix'}`)}</dd></div>
            <div><dt className="text-xs font-semibold text-muted">{t('veille.confidence')}</dt><dd className="text-ink">{item.confiance ? t(`veille.confidence.${item.confiance}`) : '—'}</dd></div>
            {item.evenement_id && <div><dt className="text-xs font-semibold text-muted">{t('veille.detail.event')}</dt><dd className="text-ink">#{item.evenement_id}</dd></div>}
            {item.groupe_doublon_id && <div><dt className="text-xs font-semibold text-muted">{t('veille.detail.duplicate')}</dt><dd><Link className="font-semibold text-brand-700 hover:underline" to={`/veille/elements/${item.groupe_doublon_id}`}>#{item.groupe_doublon_id}</Link></dd></div>}
          </dl></Card>
          <Card className="flex items-start gap-3 p-4 text-xs text-muted"><Shield className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" /><p>{t('veille.purpose')}</p></Card>
        </aside>
      </div>
    </>}</QueryContent>
  </div>;
}
