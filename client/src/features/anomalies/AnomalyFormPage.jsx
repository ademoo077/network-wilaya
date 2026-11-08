import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Save, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { anomalieCreateSchema, normaliserUrl, parseGps, todayAlgiers, zodFields } from '@anm/shared';
import { api, ApiError } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, LoadingBlock, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { compactPayload, formFromItem } from './helpers.js';
import { ClassificationSection, LocationSection, NotesSection, ProcessingSection, SourceSection } from './AnomalyFormSections.jsx';

function emptyForm() {
  return {
    plateforme: 'autre', lien_url: '', date_publication: '', date_signalement: todayAlgiers(),
    domaine_id: '', type_id: '', daira_id: '', commune_id: '', adresse_texte: '', lieu_dit: '',
    gps: null, gps_text: '', priorite: 'normale', observations: '', verification: 'a_verifier',
    agent_id: '', date_verification: '', statut: 'non_traite', epic_id: '', intervenant_autre: '',
    date_intervention: '', date_traitement: '', motif: '',
  };
}

export default function AnomalyFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { refs, setup } = useRefs();
  const { push } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [matches, setMatches] = useState([]);
  const [forceDuplicate, setForceDuplicate] = useState(false);
  const [gpsFeedback, setGpsFeedback] = useState(null);
  const [files, setFiles] = useState([]);
  useEffect(() => {
    if (!editing) return;
    api(`/anomalies/${id}`).then(({ item }) => { setForm(formFromItem(item)); setVersion(item.version); }).catch((error) => push(error.message, 'danger')).finally(() => setLoading(false));
  }, [editing, id, push]);
  const set = useCallback((key, value) => setForm((current) => ({ ...current, [key]: value })), []);
  useEffect(() => {
    const parsed = normaliserUrl(form.lien_url);
    if (!parsed.ok) { setMatches([]); return undefined; }
    if (form.plateforme === 'autre' || !form.plateforme) set('plateforme', parsed.plateforme);
    const timer = window.setTimeout(() => api(`/anomalies/check-link?url=${encodeURIComponent(form.lien_url)}`).then(({ item }) => {
      setMatches((item.matches || []).filter((match) => String(match.id) !== String(id)));
    }).catch(() => setMatches([])), 350);
    return () => window.clearTimeout(timer);
  }, [form.lien_url, form.plateforme, id, set]);
  const parseCoordinates = useCallback((value) => {
    const result = parseGps(value, { bbox: refs.parametres.gps_bbox });
    if (!result.ok) {
      const message = result.error === 'LIEN_COURT_NON_RESOLU' ? t('form.gpsShort') : t('field.gps');
      setGpsFeedback({ variant: 'danger', message }); setErrors((current) => ({ ...current, gps: message })); return false;
    }
    setErrors((current) => ({ ...current, gps: undefined }));
    if (result.lat === null) { set('gps', null); setGpsFeedback(null); return true; }
    set('gps', { lat: result.lat, lng: result.lng });
    set('gps_text', `${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`);
    if (result.warning) setGpsFeedback({ variant: 'warning', message: t('form.gpsZone') });
    else if (result.swapped) setGpsFeedback({ variant: 'info', message: t('form.gpsSwapped') });
    else setGpsFeedback(null);
    return true;
  }, [refs.parametres.gps_bbox, set, t]);
  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (position) => parseCoordinates(`${position.coords.latitude}, ${position.coords.longitude}`),
      () => push(t('common.error'), 'danger'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const uploadFiles = async (anomalyId) => {
    for (const file of files) {
      const body = new FormData(); body.append('file', file);
      await api(`/anomalies/${anomalyId}/pieces`, { method: 'POST', body });
    }
  };
  const save = async (saveNew = false) => {
    if (form.gps_text && !parseCoordinates(form.gps_text)) return;
    const payload = compactPayload(form);
    const validated = anomalieCreateSchema.safeParse(payload);
    if (!validated.success) {
      const fields = zodFields(validated.error); setErrors(fields);
      window.setTimeout(() => document.getElementById(Object.keys(fields)[0])?.focus(), 0); return;
    }
    setSaving(true); setErrors({});
    try {
      const body = { ...payload, force_duplicate: forceDuplicate };
      const result = editing
        ? await api(`/anomalies/${id}`, { method: 'PATCH', body: { ...body, version } })
        : await api('/anomalies', { method: 'POST', body });
      await uploadFiles(result.item.id);
      push(t('form.saved'));
      if (saveNew) {
        const keep = { plateforme: form.plateforme, date_signalement: form.date_signalement, daira_id: form.daira_id };
        setForm({ ...emptyForm(), ...keep }); setFiles([]); setMatches([]); setForceDuplicate(false); window.scrollTo({ top: 0 });
      } else navigate(`/anomalies/${result.item.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DUPLICATE_LINK') { setMatches(error.details || []); setForceDuplicate(false); }
      else if (error.code === 'DUPLICATE_STRICT') { setMatches(error.details || []); setErrors({ lien_url: error.message }); }
      else if (error.code === 'VERSION_CONFLICT') setErrors({ form: t('form.versionConflict') });
      else setErrors(error.fields || { form: error.message });
      push(error.message, 'danger');
    } finally { setSaving(false); }
  };
  const duplicateAlert = useMemo(() => matches.length > 0 ? <Alert variant={forceDuplicate ? 'info' : 'warning'} className="sm:col-span-2" title={t('form.duplicateTitle')} action={!forceDuplicate && <Button size="sm" variant="secondary" onClick={() => setForceDuplicate(true)}>{t('form.forceDuplicate')}</Button>}><p>{t('form.duplicateQuestion')}</p><ul className="mt-2 space-y-1">{matches.map((match) => <li key={match.id}><button className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline" onClick={() => navigate(`/anomalies/${match.id}`)}><bdi>{match.reference}</bdi><ExternalLink className="h-3.5 w-3.5" /></button></li>)}</ul></Alert> : null, [forceDuplicate, matches, navigate, t]);
  if (loading) return <div className="page-container"><LoadingBlock /></div>;
  if (setup?.referentielTerritorialVide) return <div className="page-container"><PageHeader title={t('form.newTitle')} /><Alert variant="danger" title={t('form.noTerritory')} action={user.role === 'admin' ? <Button onClick={() => navigate('/assistant')}>{t('form.configure')}</Button> : null}>{user.role === 'admin' ? t('setup.intro') : t('form.contactAdmin')}</Alert></div>;
  return <div className="page-container pb-28"><PageHeader title={editing ? t('form.editTitle') : t('form.newTitle')} />{errors.form && <Alert variant="danger" className="mb-5" title={errors.form} action={editing && <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>{t('common.refresh')}</Button>}><AlertTriangle className="h-4 w-4" /></Alert>}<div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><SourceSection form={form} set={set} errors={errors} duplicate={duplicateAlert} /><ClassificationSection form={form} set={set} errors={errors} refs={refs} lang={lang} /><LocationSection form={form} set={set} errors={errors} refs={refs} lang={lang} gpsInfo={{ parse: parseCoordinates, message: gpsFeedback?.message, variant: gpsFeedback?.variant }} locate={locate} /><ProcessingSection form={form} set={set} errors={errors} refs={refs} lang={lang} /><NotesSection form={form} set={set} files={files} setFiles={setFiles} /></div><div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--glass)] p-3 backdrop-blur-md md:start-auto"><div className="mx-auto flex max-w-[1480px] flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => navigate(-1)}><X className="h-4 w-4" />{t('common.cancel')}</Button><Button variant="secondary" loading={saving} onClick={() => save(false)}><Save className="h-4 w-4" />{t('common.save')}</Button>{!editing && <Button loading={saving} onClick={() => save(true)}>{t('common.saveNew')}</Button>}</div></div></div>;
}
