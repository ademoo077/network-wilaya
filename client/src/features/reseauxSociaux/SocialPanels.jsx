import { FileSpreadsheet, ShieldAlert, Upload } from 'lucide-react';
import { Alert, Button, Card, KpiCard } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export function ImportsPanel({ canManage, onImport }) {
  const { t } = useI18n();
  return <Card className="space-y-4 p-4" data-social-imports>
    <div className="flex flex-wrap items-start gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-100 text-brand-700"><FileSpreadsheet className="h-5 w-5" aria-hidden="true" /></div>
      <div className="min-w-0"><h3 className="text-lg font-black">{t('social.imports.title')}</h3><p className="mt-1 text-sm text-muted">{t('social.imports.help')}</p></div>
    </div>
    <Alert variant="info">{t('social.imports.refused')}</Alert>
    {canManage ? <Button onClick={onImport}><Upload className="h-4 w-4" aria-hidden="true" />{t('social.imports.start')}</Button>
      : <p className="text-xs text-muted">{t('social.qualify.readOnly')}</p>}
  </Card>;
}

const QUALITY_ITEMS = [
  { key: 'a_verifier', label: 'quality.toReview', filter: { verification: 'a_verifier', onglet: 'qualifier' } },
  { key: 'sans_nom', label: 'quality.missingName', filter: { onglet: 'repertoire' } },
  { key: 'sans_rattachement', label: 'quality.unattached', filter: { non_rattache: 'commune', onglet: 'repertoire' } },
  { key: 'sans_lien_normalise', label: 'quality.missingLink', filter: { onglet: 'repertoire' } },
];

export function QualityPanel({ resume, onFilter }) {
  const { t } = useI18n();
  return <Card className="space-y-3 p-4" data-social-quality>
    <div><h3 className="text-lg font-black">{t('social.quality')}</h3><p className="mt-1 text-sm text-muted">{t('social.qualityHelp')}</p></div>
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {QUALITY_ITEMS.map((item) => <div key={item.key}>
        <KpiCard icon={ShieldAlert} label={t(`social.${item.label}`)} value={resume?.[item.key] ?? 0} onClick={() => onFilter(item.filter)} />
      </div>)}
    </div>
  </Card>;
}
