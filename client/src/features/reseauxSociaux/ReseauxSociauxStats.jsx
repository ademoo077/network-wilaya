import { ArrowUpRight, BarChart3, CircleHelp, MapPin, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardHeader, EmptyState, SegmentedControl } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { SOCIAL_ICONS } from './CompteSocialBadges.jsx';

function Distribution({ rows, title, description, label, onChoose, icon: DefaultIcon = BarChart3 }) {
  const { t } = useI18n();
  return <Card><CardHeader title={title} description={description} />
    {rows.length ? <ul className="space-y-4 p-5">{rows.map((row) => {
      const Icon = SOCIAL_ICONS[row.key] || DefaultIcon;
      return <li key={row.key}><button type="button" className="group w-full rounded-md text-start" onClick={() => onChoose(row)}>
        <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          <span className="text-sm font-semibold group-hover:underline"><bdi>{label(row)}</bdi></span></div>
          <span data-social-share className="flex shrink-0 items-baseline gap-2 text-sm font-bold"><bdi data-share-total dir="ltr">{row.total}</bdi>
            <bdi data-share-percentage dir="ltr" className="text-xs font-medium text-muted">{row.pourcentage === null ? '—' : `${row.pourcentage} %`}</bdi></span>
        </div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2" aria-hidden="true"><div className="h-full rounded-full bg-brand-700" style={{ width: `${row.pourcentage || 0}%` }} /></div>
      </button></li>;
    })}</ul> : <EmptyState compact title={t('social.noStatistics')} />}
  </Card>;
}
export default function ReseauxSociauxStats({ data, onDrill }) {
  const { t, lang } = useI18n(); const [coverageMode, setCoverageMode] = useState('toutes');
  const { resume } = data;
  const communes = data.communes.filter((row) => coverageMode !== 'sans_compte' || row.total === 0);
  return <div className="space-y-5" data-social-stats>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Distribution rows={data.reseaux} title={t('social.byNetwork')} description={t('social.distributionHelp')}
        label={(row) => t(`platform.${row.key}`)} onChoose={(row) => onDrill({ plateforme: row.key })} />
      <Distribution rows={data.types} title={t('social.byType')} description={t('social.distributionHelp')}
        label={(row) => t(`social.type.${row.key}`)} onChoose={(row) => onDrill({ categorie: row.key })} />
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card className="p-5"><div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-brand-700" aria-hidden="true" /><h2 className="font-bold">{t('social.coverage')}</h2></div>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2"><p className="text-3xl font-black"><bdi data-social-coverage-ratio dir="ltr">{resume.communes_couvertes}<span className="ms-1 text-base font-semibold text-muted"> / {resume.communes_referentiel}</span></bdi></p>
          <bdi data-social-coverage-percentage dir="ltr" className="text-sm font-bold text-brand-700">{resume.couverture === null ? '—' : `${resume.couverture} %`}</bdi></div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface2" role="meter" aria-label={t('social.coverage')} aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={resume.couverture || 0}><div className="h-full rounded-full bg-brand-700" style={{ width: `${resume.couverture || 0}%` }} /></div>
        <p className="mt-3 text-xs text-muted">{t('social.coverageHelp')}</p>
        <p className="mt-3 text-sm font-semibold">{t('social.uncoveredCount', { count: resume.communes_sans_compte })}</p>
      </Card>
      <Card className="p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-700" aria-hidden="true" /><h2 className="font-bold">{t('social.quality')}</h2></div>
        <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-md border border-border p-3"><p className="text-2xl font-black">{resume.a_verifier}</p><p className="mt-1 text-xs text-muted">{t('social.verification.a_verifier')}</p></div>
          <div className="rounded-md border border-border p-3"><p className="text-2xl font-black">{resume.sans_rattachement}</p><p className="mt-1 text-xs text-muted">{t('social.unlinked')}</p></div></div>
        <p className="mt-3 text-xs text-muted">{t('social.qualityHelp')}</p>
        <Button className="mt-3" variant="secondary" onClick={() => onDrill({ verification: 'a_verifier' })}><CircleHelp className="h-4 w-4" aria-hidden="true" />{t('social.reviewAccounts')}</Button>
      </Card>
    </div>
    <Card><CardHeader title={t('social.byCa')} description={t('social.drillHelp')} />
      <ul className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{data.ca.map((row, index) => <li key={row.id || `source-${index}`}>
        <button type="button" className="flex min-h-16 w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-start transition hover:bg-surface2"
          onClick={() => onDrill(row.id ? { daira_id: String(row.id), commune_id: '' }
            : { daira_id: '', commune_id: '', non_rattache: 'ca', ca_libelle: row.name_fr || '', commune_libelle: '' })}>
          <div className="min-w-0"><p className="break-words text-sm font-bold"><bdi>{refLabel(row, lang)}</bdi></p><p className="mt-1 text-xs text-muted">{t('social.caCounts', { pages: row.pages, profils: row.profils })}</p></div>
          <span className="shrink-0 rounded-md bg-brand-100 px-2.5 py-1.5 text-sm font-black text-brand-700">{row.total}</span>
        </button>
      </li>)}</ul>
    </Card>
    <Card className="overflow-hidden"><CardHeader title={t('social.byCommune')} description={t('social.communeStatisticsHelp')} action={<SegmentedControl label={t('social.coverageDisplay')} value={coverageMode}
      options={[{ value: 'toutes', label: t('social.allCommunes') }, { value: 'sans_compte', label: t('social.uncoveredCommunes') }]} onChange={setCoverageMode} />} />
      <div className="max-h-[32rem] overflow-auto"><table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{t('social.byCommune')}</caption>
        <thead className="sticky top-0 bg-surface2"><tr>{['commune', 'ca', 'pages', 'profils', 'groupes', 'chaines', 'autres', 'total'].map((key) => <th key={key} scope="col"
          className="whitespace-nowrap border-b border-border px-3 py-3 text-start text-xs font-bold text-muted">{t(key === 'commune' ? 'field.commune' : key === 'ca' ? 'social.ca' : `social.count.${key}`)}</th>)}</tr></thead>
        <tbody>{communes.map((row, index) => <tr key={row.id || `source-${index}`} className="hover:bg-surface2">
          <td className="border-b border-border px-3 py-2"><button type="button" className="flex min-h-11 items-center gap-1.5 text-start font-semibold text-brand-700 hover:underline"
            onClick={() => onDrill(row.id ? { daira_id: String(row.daira_id), commune_id: String(row.id) }
              : { daira_id: row.daira_id ? String(row.daira_id) : '', commune_id: '', non_rattache: 'commune',
                ca_libelle: row.ca_fr || '', commune_libelle: row.name_fr || '' })}>
            <bdi>{refLabel(row, lang)}</bdi><ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></button>{!row.id && <span className="block text-xs text-muted">{t('social.unlinked')}</span>}</td>
          <td className="border-b border-border px-3 py-2"><bdi>{lang === 'ar' ? row.ca_ar || row.ca_fr || '—' : row.ca_fr || row.ca_ar || '—'}</bdi></td>
          {['pages', 'profils', 'groupes', 'chaines', 'autres', 'total'].map((key) => <td key={key} className={`border-b border-border px-3 py-2 ${key === 'total' ? 'font-bold' : 'text-ink2'}`}>{row[key]}</td>)}
        </tr>)}</tbody>
      </table></div>
      {!communes.length && <EmptyState compact title={t('social.noUncovered')} />}
    </Card>
  </div>;
}
