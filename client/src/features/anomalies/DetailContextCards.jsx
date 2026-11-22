import { useState } from 'react';
import { ExternalLink, MapPinned, UserRound } from 'lucide-react';
import { formatDate, formatGps } from '@anm/shared';
import { api } from '../../api/client.js';
import { Button, Card, CardHeader, Dialog, PlatformBadge, Select, Textarea, useToast } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import MiniMap from '../map/MiniMap.jsx';

function Field({ label, children }) {
  return <div><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink">{children || '—'}</dd></div>;
}

export default function DetailContextCards({ item, agents, tiles, writable, onReload }) {
  const { t, lang } = useI18n(); const { push } = useToast();
  const [open, setOpen] = useState(false); const [agentId, setAgentId] = useState(String(item.agent_id || ''));
  const [motif, setMotif] = useState(''); const [busy, setBusy] = useState(false);
  const manuel = item.agent_source === 'manuel';
  const affecteLe = item.date_affectation || item.date_verification;
  const options = [{ value: '', label: t('common.none') || '—' }, ...(agents || []).map((agent) => ({
    value: String(agent.id), label: refLabel(agent, lang),
  }))];
  const reassigner = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/anomalies/${item.id}`, { method: 'PATCH', body: {
        version: item.version, agent_id: agentId ? Number(agentId) : null, agent_motif: motif.trim(),
      } });
      push(t('common.saved'));
      setOpen(false); setMotif(''); onReload();
    } catch (error) { push(error.message, 'danger'); } finally { setBusy(false); }
  };
  return <>
    <Card data-detail-agent>
      <CardHeader title={t('detail.agentBlock')} />
      <dl className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label={t('field.agent')}><bdi>{item.agent_nom || '—'}</bdi></Field>
        <Field label={t('detail.origin')}>{manuel ? t('detail.manual') : t('detail.auto')}</Field>
        <Field label={t('detail.assignedOn')}>{formatDate(affecteLe)}</Field>
        <Field label={t('field.reason')}><bdi>{item.agent_motif}</bdi></Field>
      </dl>
      {writable && <div className="border-t border-border p-4">
        <Button size="sm" variant="secondary" onClick={() => { setAgentId(String(item.agent_id || '')); setOpen(true); }}>
          <UserRound className="h-4 w-4" aria-hidden="true" />{t('detail.reassign')}
        </Button>
      </div>}
    </Card>
    <Card data-detail-source>
      <CardHeader title={t('detail.sourceBlock')} />
      <div className="space-y-3 p-5">
        <PlatformBadge value={item.plateforme} />
        <p className="text-xs font-bold text-muted">{t('detail.network')}</p>
        <bdi className="block break-words text-sm font-semibold">{item.lien_url || '—'}</bdi>
        {item.lien_url_sur && <Button size="sm" variant="ghost" as="a" href={item.lien_url_sur} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />{t('detail.openSource')}
        </Button>}
      </div>
    </Card>
    {item.gps && <Card data-detail-gps>
      <CardHeader title={t('detail.gpsBlock')} />
      <div className="space-y-3 p-3">
        <MiniMap value={item.gps} tileUrl={tiles} interactive={false} />
        <p className="px-2 text-sm font-semibold"><bdi>{formatGps(item.gps.lat, item.gps.lng)}</bdi></p>
        <Button size="sm" variant="ghost" as="a" href={`https://www.google.com/maps/dir/?api=1&destination=${item.gps.lat},${item.gps.lng}`} target="_blank" rel="noopener noreferrer">
          <MapPinned className="h-4 w-4" aria-hidden="true" />{t('detail.openMap')}
        </Button>
      </div>
    </Card>}
    <Dialog open={open} onClose={() => setOpen(false)} title={t('detail.reassign')} footer={<>
      <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
      <Button type="submit" form="reassign-form" loading={busy} disabled={!motif.trim()}>{t('common.save')}</Button>
    </>}>
      <form id="reassign-form" onSubmit={reassigner} className="space-y-4">
        <p className="text-sm text-ink2">{t('detail.reassignHelp')}</p>
        <Select label={t('field.agent')} value={agentId} onChange={(event) => setAgentId(event.target.value)} options={options} />
        <Textarea label={t('field.reason')} required maxLength={1000} value={motif} onChange={(event) => setMotif(event.target.value)} />
      </form>
    </Dialog>
  </>;
}
