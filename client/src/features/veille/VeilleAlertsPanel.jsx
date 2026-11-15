import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '@anm/shared';
import { api } from '../../api/client.js';
import { Button, Card, EmptyState, useToast } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

function alertTitle(alert, t, lang) {
  const details = alert.details || {};
  if (alert.regle === 'source_erreur') return t('veille.alert.sourceError', { name: details.source || '—' });
  if (alert.regle === 'jeton_expiration') return t('veille.alert.tokenExpiry', { date: details.expire_le ? formatDateTime(details.expire_le) : '—' });
  if (alert.regle === 'attente_qualification') return t('veille.alert.pending', { count: details.count || 0 });
  if (alert.regle === 'terme_critique') return t('veille.alert.critical', { term: details.terme || '—' });
  if (alert.regle === 'publication_virale') return t('veille.alert.viral', { page: details.page_nom || '—' });
  if (alert.regle === 'pic_activite') {
    const group = lang === 'ar' ? details.groupe_ar || details.groupe_fr : details.groupe_fr;
    const commune = lang === 'ar' ? details.commune_ar || details.commune_fr : details.commune_fr;
    return t('veille.alert.peak', { group: group || '—', commune: commune || '—' });
  }
  return alert.titre;
}

function severityClass(gravite) {
  if (gravite === 'critique') return 'bg-danger';
  if (gravite === 'avertissement') return 'bg-warning';
  return 'bg-brand-600';
}

export default function VeilleAlertsPanel({ onChanged }) {
  const { t, lang } = useI18n(); const { push } = useToast();
  const query = useApiQuery('/veille/alertes?non_lues=1');
  const items = query.data?.items || [];

  const read = async (id) => {
    try {
      await api(`/veille/alertes/${id}/lue`, { method: 'POST' });
      await query.refetch(); onChanged?.();
    } catch (cause) { push(cause.message, 'danger'); }
  };
  const readAll = async () => {
    try {
      await api('/veille/alertes/tout-lues', { method: 'POST' });
      await query.refetch(); onChanged?.();
    } catch (cause) { push(cause.message, 'danger'); }
  };

  return <Card className="p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-bold text-ink">
        <Bell className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.alerts')}
        {items.length > 0 && <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs font-bold text-ink2">{items.length}</span>}
      </h2>
      {items.length > 0 && <Button size="sm" variant="ghost" onClick={readAll}><CheckCheck className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.markAll')}</Button>}
    </div>
    <QueryContent query={query}>
      {items.length ? <ul className="grid gap-2">{items.map((alert) => <li key={alert.id} className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${severityClass(alert.gravite)}`} aria-hidden="true" />
              <bdi>{alertTitle(alert, t, lang)}</bdi>
            </p>
            <p className="mt-1 text-xs text-muted">{t(`veille.alert.rule.${alert.regle}`)} · {formatDateTime(alert.created_at)}</p>
          </div>
          <div className="flex items-center gap-1">
            {alert.details?.element_id && <Link className="inline-flex min-h-9 items-center rounded-md px-2 text-xs font-semibold text-brand-700 hover:bg-surface2" to={`/veille/elements/${alert.details.element_id}`}>
              {t('common.open')}<ExternalLink className="ms-1 h-3.5 w-3.5" aria-hidden="true" /></Link>}
            <Button size="sm" variant="ghost" onClick={() => read(alert.id)}>{t('veille.dashboard.markRead')}</Button>
          </div>
        </div>
      </li>)}</ul> : <EmptyState icon={Bell} title={t('veille.dashboard.noAlerts')} />}
    </QueryContent>
  </Card>;
}
