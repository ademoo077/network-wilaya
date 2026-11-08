import { LocateFixed, MapPin } from 'lucide-react';
import { Card, CardHeader, Combobox, Input, Select, SegmentedControl, Textarea, Button, Alert } from '../../components/ui/index.js';
import { PLATEFORMES, PRIORITES, STATUTS, VERIFICATIONS } from '@anm/shared';
import { useI18n } from '../../i18n/index.jsx';
import MiniMap from '../map/MiniMap.jsx';
import { refOptions } from './helpers.js';

function Section({ title, children, className = '' }) {
  return <Card className={className}><CardHeader title={title} /><div className="grid gap-4 p-5 sm:grid-cols-2">{children}</div></Card>;
}

export function SourceSection({ form, set, errors, duplicate }) {
  const { t } = useI18n();
  return <Section title={t('form.source')} className="lg:col-span-2"><Input id="lien_url" className="sm:col-span-2" label={t('field.link')} placeholder={t('form.linkPlaceholder')} type="url" required value={form.lien_url} error={errors.lien_url} onChange={(event) => set('lien_url', event.target.value)} />{duplicate}<Select label={t('field.platform')} value={form.plateforme} onChange={(event) => set('plateforme', event.target.value)} options={PLATEFORMES.map((value) => ({ value, label: t(`platform.${value}`) }))} /><Input label={t('field.publicationDate')} type="date" value={form.date_publication} error={errors.date_publication} onChange={(event) => set('date_publication', event.target.value)} /><Input label={t('field.reportDate')} type="date" required value={form.date_signalement} error={errors.date_signalement} onChange={(event) => set('date_signalement', event.target.value)} /></Section>;
}

export function ClassificationSection({ form, set, errors, refs, lang }) {
  const { t } = useI18n();
  const domain = refs.domaines.find((item) => String(item.id) === String(form.domaine_id));
  return <Section title={t('form.classification')}><Combobox label={t('field.category')} required value={form.domaine_id} error={errors.domaine_id} options={refOptions(refs.domaines, lang)} onChange={(value) => { set('domaine_id', value); set('type_id', ''); }} /><Combobox label={t('field.type')} required value={form.type_id} error={errors.type_id} options={refOptions(domain?.types || [], lang)} onChange={(value) => set('type_id', value)} /><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">{t('field.priority')}</label><SegmentedControl label={t('field.priority')} value={form.priorite} onChange={(value) => set('priorite', value)} options={PRIORITES.map((value) => ({ value, label: t(`priority.${value}`) }))} /></div></Section>;
}

export function LocationSection({ form, set, errors, refs, lang, gpsInfo, locate }) {
  const { t } = useI18n();
  const daira = refs.dairas.find((item) => String(item.id) === String(form.daira_id));
  return <Section title={t('form.location')}><Combobox label={t('field.daira')} required value={form.daira_id} error={errors.daira_id} options={refOptions(refs.dairas, lang)} onChange={(value) => { set('daira_id', value); set('commune_id', ''); }} /><Combobox label={t('field.commune')} required value={form.commune_id} error={errors.commune_id} options={refOptions(daira?.communes || [], lang)} onChange={(value) => set('commune_id', value)} /><Input label={t('field.address')} value={form.adresse_texte} onChange={(event) => set('adresse_texte', event.target.value)} /><Input label={t('field.place')} value={form.lieu_dit} onChange={(event) => set('lieu_dit', event.target.value)} /><div className="sm:col-span-2"><div className="flex items-end gap-2"><Input className="flex-1" label={t('field.gps')} value={form.gps_text} error={errors.gps} onChange={(event) => set('gps_text', event.target.value)} onBlur={() => gpsInfo.parse(form.gps_text)} /><Button variant="secondary" aria-label={t('form.locationButton')} onClick={locate}><LocateFixed className="h-4 w-4" /><span className="hidden sm:inline">{t('form.locationButton')}</span></Button></div>{gpsInfo.message && <Alert variant={gpsInfo.variant} className="mt-2">{gpsInfo.message}</Alert>}{form.gps && <a className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700 hover:underline" href={`https://www.google.com/maps?q=${form.gps.lat},${form.gps.lng}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4" />{t('form.openMaps')}</a>}<div className="mt-3"><MiniMap value={form.gps} onChange={(value) => { set('gps', value); set('gps_text', `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`); }} tileUrl={refs.parametres.tile_url} /></div></div></Section>;
}

export function ProcessingSection({ form, set, errors, refs, lang }) {
  const { t } = useI18n();
  const needsAgent = form.verification !== 'a_verifier';
  const processing = form.statut !== 'non_traite';
  const suggested = [...refs.epics].sort((a, b) => Number(b.domaine_ids?.includes(Number(form.domaine_id))) - Number(a.domaine_ids?.includes(Number(form.domaine_id))));
  return <Section title={t('form.processing')}><Select label={t('field.verification')} value={form.verification} error={errors.verification} options={VERIFICATIONS.map((value) => ({ value, label: t(`verification.${value}`) }))} onChange={(event) => set('verification', event.target.value)} />{needsAgent && <Combobox label={t('field.agent')} required value={form.agent_id} error={errors.agent_id} options={refOptions(refs.agents, lang)} onChange={(value) => set('agent_id', value)} />}{needsAgent && <Input label={t('field.verificationDate')} type="date" value={form.date_verification} onChange={(event) => set('date_verification', event.target.value)} />}<Select label={t('field.status')} value={form.statut} error={errors.statut} hint={form.verification !== 'confirmee' ? t('form.detected', { platform: t('verification.a_verifier') }) : undefined} options={STATUTS.map((value) => ({ value, label: t(`status.${value}`), disabled: value !== 'non_traite' && form.verification !== 'confirmee' }))} onChange={(event) => set('statut', event.target.value)} />{processing && <Combobox label={t('field.epic')} value={form.epic_id} error={errors.epic_id} options={refOptions(suggested, lang)} onChange={(value) => set('epic_id', value)} />}{processing && !form.epic_id && <Input label={t('field.otherParty')} value={form.intervenant_autre} error={errors.intervenant_autre} onChange={(event) => set('intervenant_autre', event.target.value)} />}{processing && <Input label={t('field.interventionDate')} type="date" value={form.date_intervention} error={errors.date_intervention} onChange={(event) => set('date_intervention', event.target.value)} />}{form.statut === 'traite' && <Input label={t('field.treatmentDate')} type="date" value={form.date_traitement} error={errors.date_traitement} onChange={(event) => set('date_traitement', event.target.value)} />}{form.motif !== undefined && <Textarea className="sm:col-span-2" label={t('field.reason')} maxLength={1000} value={form.motif} error={errors.motif} onChange={(event) => set('motif', event.target.value)} />}</Section>;
}

export function NotesSection({ form, set, files, setFiles }) {
  const { t } = useI18n();
  return <Section title={t('form.notesFiles')} className="lg:col-span-2"><Textarea className="sm:col-span-2" label={t('field.observations')} maxLength={5000} rows={4} value={form.observations} onChange={(event) => set('observations', event.target.value)} /><label className="sm:col-span-2 grid min-h-28 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-surface2 p-4 text-center text-sm text-muted hover:border-brand-600"><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setFiles([...event.target.files].slice(0, 5))} /><span>{t('form.dropFiles')}</span></label>{files.length > 0 && <ul className="sm:col-span-2 text-sm text-ink">{files.map((file) => <li key={`${file.name}-${file.size}`}><bdi>{file.name}</bdi> · {Math.round(file.size / 1024)} Ko</li>)}</ul>}</Section>;
}
