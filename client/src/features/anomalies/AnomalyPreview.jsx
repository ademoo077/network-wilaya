import { ExternalLink, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { estSansSuite, formatDate, formatGps } from '@anm/shared';
import { Button, Drawer, PlatformBadge, PriorityBadge, StatusBadge } from '../../components/ui/index.js';
import { anomalyLabel } from './helpers.js';
import { useI18n } from '../../i18n/index.jsx';

export default function AnomalyPreview({ item, onClose }) {
  const { t, lang } = useI18n();
  return <Drawer open={Boolean(item)} onClose={onClose} title={t('anomalies.preview')}>{item && <div><div className="flex flex-wrap items-center gap-2"><StatusBadge value={item.statut} />{estSansSuite(item) && <span className="inline-flex items-center gap-1 rounded-sm bg-stnonbg px-2 py-0.5 text-xs font-semibold text-stnon">{t('detail.sansSuite')}</span>}<PriorityBadge value={item.priorite} /></div><h2 className="mt-4 text-2xl font-black text-brand-700"><bdi>{item.reference}</bdi></h2><p className="mt-1 text-sm text-muted">{formatDate(item.date_signalement)}</p><dl className="mt-6 grid gap-4 sm:grid-cols-2"><Field label={t('field.platform')}><PlatformBadge value={item.plateforme} /></Field><Field label={t('field.category')} value={anomalyLabel(item, 'domaine', lang)} /><Field label={t('field.type')} value={anomalyLabel(item, 'type', lang)} /><Field label={t('field.daira')} value={anomalyLabel(item, 'daira', lang)} /><Field label={t('field.commune')} value={anomalyLabel(item, 'commune', lang)} /><Field label={t('field.epic')} value={item.epic_name || item.intervenant_autre} /><Field label={t('field.gps')} value={item.gps ? formatGps(item.gps.lat, item.gps.lng) : null} /></dl>{item.adresse_texte && <p className="mt-5 flex items-start gap-2 rounded-md bg-surface2 p-3 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><bdi>{item.adresse_texte}</bdi></p>}<div className="mt-6 flex flex-wrap gap-2"><Button as={Link} to={`/anomalies/${item.id}`}>{t('anomalies.openSheet')}</Button><Button as="a" variant="secondary" href={item.lien_url_sur} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{t('field.link')}</Button></div></div>}</Drawer>;
}

function Field({ label, value, children }) {
  return <div><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink">{children || <bdi>{value || '—'}</bdi>}</dd></div>;
}
