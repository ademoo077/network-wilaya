import { Copy, LocateFixed } from 'lucide-react';
import { formatGps } from '@anm/shared';
import { Alert, Button, Checkbox, Combobox, Input, StatusBadge, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import MiniMap from '../map/MiniMap.jsx';
import { refOptions } from './helpers.js';
import { Section } from './AnomalyFormSections.jsx';
import FormFeedback from './FormFeedback.jsx';

export default function FormLocation({ model }) {
  const { t } = useI18n(); const { push } = useToast(); const { state, set, errors, refs, lang, paste, nearby, geometry, ui } = model; const form = state.values;
  const daira = refs.dairas.find((item) => String(item.id) === form.daira_id);
  const duplicate = nearby.find((item) => item.statut !== 'traite' && item.distance_m <= Number(refs.parametres.rayon_doublon_m || 50) && item.id !== state.dismissedGeo);
  const copy = async () => { try { await navigator.clipboard.writeText(formatGps(form.gps.lat, form.gps.lng)); push(t('common.copied')); } catch { document.getElementById('gps_text')?.select(); push(t('smart.ctrlC'), 'warning'); } };
  return <Section title={t('form.location')}>
    <Combobox id="daira_id" label={t('field.daira')} placeholder={t('form.dairaPlaceholder')} required value={form.daira_id} error={errors.daira_id}
      options={refOptions(refs.dairas, lang)} onChange={(value) => { set('daira_id', String(value)); set('commune_id', ''); }} />
    <Combobox id="commune_id" label={t('field.commune')} placeholder={t('form.communePlaceholder')} disabled={!form.daira_id} hint={!form.daira_id ? t('form.chooseDaira') : undefined}
      required value={form.commune_id} error={errors.commune_id} options={refOptions(daira?.communes || [], lang)} onChange={(value) => set('commune_id', String(value))} />
    <Input id="adresse_texte" label={t('field.address')} value={form.adresse_texte} onChange={(event) => set('adresse_texte', event.target.value)} />
    <Input id="lieu_dit" label={t('field.place')} value={form.lieu_dit} onChange={(event) => set('lieu_dit', event.target.value)} />
    <div id="gps-map" className="min-w-0 sm:col-span-2">
      <Input id="gps_text" label={t('field.gps')} placeholder="36.753800, 3.058800" value={form.gps_text} error={errors.gps}
        onChange={(event) => paste.input(event.target.value, 'gps_text')} onBlur={() => {
          if (form.gps_text && form.gps_text !== formatGps(form.gps?.lat, form.gps?.lng)) paste.analyze(form.gps_text, 'gps_text', true);
        }} />
      <FormFeedback model={model} field="gps" />
      {state.feedback.gps === 'gps.invalide' && <div className="mt-2 flex flex-wrap gap-1">{['36.7538, 3.0588', '36°45\'13.68"N 3°03\'31.68"E', 'V75V+8R Alger'].map((text) => <Button key={text} size="sm" variant="secondary" onClick={() => paste.analyze(text, 'gps_text')}>{text}</Button>)}</div>}
      <div className="my-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={!window.isSecureContext} title={!window.isSecureContext ? t('gps.requiresHttps') : undefined}
        loading={state.tasks.device?.status === 'loading'} onClick={model.locateDevice}><LocateFixed className="h-4 w-4" />{t('form.locationButton')}</Button>
        {form.gps && <><Button as="a" variant="secondary" href={`https://www.google.com/maps?q=${form.gps.lat},${form.gps.lng}`} target="_blank" rel="noopener noreferrer">{t('gps.openMaps')}</Button>
          <Button variant="secondary" onClick={copy}><Copy className="h-4 w-4" />{t('gps.copy')}</Button></>}</div>
      {!window.isSecureContext && <p className="mb-2 text-xs text-warning">{t('gps.requiresHttps')}</p>}
      {state.tasks.device?.status === 'error' && <Alert variant="danger" className="mb-2">{t('gps.deviceError')}</Alert>}
      {form.gps && <p data-gps-source className="mb-2 text-sm font-bold">{t('gps.source')} : {t(`gps.source.${state.meta.gps?.source || form.gps_source || 'manuel'}`)}</p>}
      <MiniMap value={form.gps} onChange={(point) => set('gps', point, 'carte')} nearby={nearby} focusGeometry={geometry} tileUrl={refs.parametres.tile_url} className="h-[240px] sm:h-[280px]" />
      {form.gps && <Checkbox label={t('gps.confirmed')} checked={Boolean(form.gps_verifiee)} onChange={(event) => set('gps_verifiee', event.target.checked ? 1 : 0)} />}
      {duplicate && <Alert variant="warning" className="mt-3">{t('gps.duplicate', { reference: duplicate.reference, distance: duplicate.distance_m, status: t(`status.${duplicate.statut}`) })}
        <div className="mt-2 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => ui({ dismissedGeo: duplicate.id })}>{t('gps.different')}</Button>
          <Button variant="secondary" onClick={() => { set('lie_a_id', duplicate.id); ui({ dismissedGeo: duplicate.id }); push(t('gps.linked')); }}>{t('gps.linkRepeat')}</Button></div></Alert>}
      <h3 className="mt-4 text-sm font-bold">{t('gps.nearby')}</h3>
      {state.tasks.nearby.status === 'loading' ? <p role="status">{t('common.loading')}</p> : nearby.length ? <ul className="mt-2 max-h-72 space-y-2 overflow-auto">{nearby.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
        <a className="inline-flex min-h-11 items-center text-brand-700 underline" href={`#/anomalies/${item.id}`}>{item.reference}</a><StatusBadge value={item.statut} /><span>{item.distance_m} m</span></li>)}</ul> : <p className="mt-2 text-sm text-muted">{t('gps.noNearby')}</p>}
    </div></Section>;
}
