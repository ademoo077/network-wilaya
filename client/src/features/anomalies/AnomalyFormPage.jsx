import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Save, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { anomalieCreateSchema, normaliserUrl, parseGps, todayAlgiers, zodFields } from '@anm/shared';
import { api, ApiError, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, LoadingBlock, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { compactPayload, formFromItem } from './helpers.js';
import { ClassificationSection, LocationSection, NotesSection, ProcessingSection, SourceSection } from './AnomalyFormSections.jsx';
import SmartPasteZone from './SmartPasteZone.jsx';

function emptyForm() {
  return {
    plateforme: 'autre', lien_url: '', date_publication: '', date_signalement: todayAlgiers(),
    domaine_id: '', type_id: '', daira_id: '', commune_id: '', adresse_texte: '', lieu_dit: '',
    gps: null, gps_text: '', gps_source: '', gps_precision_m: null, gps_verifiee: 0,
    lie_a_id: null, contenu_type: null, date_publication_estimee: 0, legende: '', auteur_publication: '',
    priorite: 'normale', observations: '', verification: 'a_verifier',
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
  const [exifProposal, setExifProposal] = useState(null);
  const [exifMessage, setExifMessage] = useState('');
  const [geoSuggestion, setGeoSuggestion] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [focusGeometry, setFocusGeometry] = useState(null);
  const [dismissedGeo, setDismissedGeo] = useState(null);
  const smartRef = useRef(null);
  const manualFields = useRef(new Set());
  useEffect(() => {
    if (!editing) return;
    api(`/anomalies/${id}`).then(({ item }) => { setForm(formFromItem(item)); setVersion(item.version); }).catch((error) => push(error.message, 'danger')).finally(() => setLoading(false));
  }, [editing, id, push]);
  const set = useCallback((key, value) => {
    manualFields.current.add(key);
    setForm((current) => ({ ...current, [key]: value }));
  }, []);
  const handleFiles = useCallback(async (incoming) => {
    const nextFiles = [...files, ...incoming].filter((file, index, all) => all.findIndex((item) => item.name === file.name && item.size === file.size) === index).slice(0, 5);
    setFiles(nextFiles);
    setExifProposal(null); setExifMessage('');
    const jpeg = incoming.find((file) => /image\/jpeg/i.test(file.type) || /\.jpe?g$/i.test(file.name));
    if (!jpeg) { if (incoming.length) setExifMessage(t('exif.none')); return; }
    try {
      const exifr = await import('exifr');
      const [position, metadata] = await Promise.all([exifr.gps(jpeg), exifr.parse(jpeg, ['GPSHPositioningError'])]);
      if (position?.latitude !== undefined && position?.longitude !== undefined) {
        setExifProposal({ file: jpeg, lat: position.latitude, lng: position.longitude, precision: Math.max(1, Math.round(metadata?.GPSHPositioningError || 10)) });
      } else setExifMessage(t('exif.none'));
    } catch { setExifMessage(t('exif.none')); }
  }, [files, t]);
  const applySmart = useCallback((result, coordinate, includeText) => {
    const before = { ...form };
    const next = { ...form };
    let changed = false;
    let protectedField = false;
    const assign = (key, value, canReplace = (current) => current === '' || current === null || current === undefined) => {
      if (value === undefined || value === null || value === '') return;
      if (manualFields.current.has(key) || !canReplace(next[key])) { if (String(next[key] ?? '') !== String(value)) protectedField = true; return; }
      if (String(next[key] ?? '') !== String(value)) { next[key] = value; changed = true; }
    };
    const social = result.urls.find((url) => url.type === 'social');
    if (social) {
      assign('lien_url', social.normalise);
      assign('plateforme', social.plateforme, (current) => !current || current === 'autre');
      assign('contenu_type', social.contenuType);
    }
    const estimated = result.dates.find((date) => date.estimee);
    if (estimated) { assign('date_publication', estimated.date); if (next.date_publication === estimated.date) next.date_publication_estimee = 1; }
    if (coordinate) {
      if (!next.gps && !manualFields.current.has('gps')) {
        next.gps = { lat: coordinate.lat, lng: coordinate.lng };
        next.gps_text = `${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}`;
        next.gps_source = coordinate.source || 'manuel';
        next.gps_precision_m = coordinate.precision_m ?? null;
        changed = true;
      } else if (next.gps && (next.gps.lat !== coordinate.lat || next.gps.lng !== coordinate.lng)) protectedField = true;
    }
    if (includeText && result.texteRestant.length >= 10) assign('observations', result.texteRestant);
    if (changed) {
      setForm(next);
      push(protectedField ? `${t('smart.applied')} · ${t('smart.protected')}` : t('smart.applied'), 'success', {
        label: t('smart.undo'), onClick: () => setForm(before),
      });
    }
  }, [form, push, t]);
  useEffect(() => {
    const parsed = normaliserUrl(form.lien_url);
    if (!parsed.ok) { setMatches([]); return undefined; }
    if (form.plateforme === 'autre' || !form.plateforme) set('plateforme', parsed.plateforme);
    const timer = window.setTimeout(() => api(`/anomalies/check-link?url=${encodeURIComponent(form.lien_url)}`).then(({ item }) => {
      setMatches((item.matches || []).filter((match) => String(match.id) !== String(id)));
    }).catch(() => setMatches([])), 350);
    return () => window.clearTimeout(timer);
  }, [form, form.lien_url, form.plateforme, id, set]);
  useEffect(() => {
    const onPaste = (event) => {
      if (event.defaultPrevented || !['smart-paste', 'lien_url', 'gps_text'].includes(event.target?.id)) return;
      const pastedFiles = [...(event.clipboardData?.items || [])].filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter(Boolean);
      if (pastedFiles.length) { event.preventDefault(); handleFiles(pastedFiles); return; }
      const value = event.clipboardData?.getData('text/plain');
      if (value) { event.preventDefault(); smartRef.current?.analyze(value); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [handleFiles]);
  useEffect(() => {
    if (!form.gps) { setGeoSuggestion(null); return undefined; }
    const timer = window.setTimeout(() => api('/geo/locate', { method: 'POST', body: form.gps }).then(({ item }) => {
      setGeoSuggestion(item);
      if (item.methode === 'polygone' && !form.daira_id && !form.commune_id
        && !manualFields.current.has('daira_id') && !manualFields.current.has('commune_id')) {
        const before = { ...form };
        setForm((current) => ({ ...current, daira_id: String(item.daira_id), commune_id: String(item.commune_id) }));
        push(t('smart.applied'), 'success', { label: t('smart.undo'), onClick: () => setForm(before) });
      }
    }).catch(() => setGeoSuggestion(null)), 400);
    return () => window.clearTimeout(timer);
  }, [form, push, t]);
  useEffect(() => {
    if (!form.gps || (!form.type_id && !form.domaine_id)) { setNearby([]); return undefined; }
    const timer = window.setTimeout(() => api(`/anomalies/nearby${queryString({
      lat: form.gps.lat, lng: form.gps.lng, radius: 150,
      type: form.type_id || undefined, domaine: form.type_id ? undefined : form.domaine_id,
      exclude: id || undefined,
    })}`).then(({ items }) => setNearby(items)).catch(() => setNearby([])), 400);
    return () => window.clearTimeout(timer);
  }, [form.domaine_id, form.gps, form.type_id, id]);
  useEffect(() => {
    if (!form.commune_id) { setFocusGeometry(null); return undefined; }
    let cancelled = false;
    api(`/geo/limit/${form.commune_id}`).then(({ item }) => { if (!cancelled) setFocusGeometry(item); }).catch(() => { if (!cancelled) setFocusGeometry(null); });
    return () => { cancelled = true; };
  }, [form.commune_id]);
  const parseCoordinates = useCallback((value) => {
    const result = parseGps(value, { bbox: refs.parametres.gps_bbox });
    if (!result.ok) {
      const message = result.error === 'LIEN_COURT_NON_RESOLU' ? t('form.gpsShort') : t('field.gps');
      setGpsFeedback({ variant: 'danger', message }); setErrors((current) => ({ ...current, gps: message })); return false;
    }
    setErrors((current) => ({ ...current, gps: undefined }));
    if (result.lat === null) { set('gps', null); set('gps_source', null); setGpsFeedback(null); return true; }
    set('gps', { lat: result.lat, lng: result.lng });
    set('gps_text', `${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`);
    set('gps_source', /^https?:/i.test(value) ? 'lien_carte' : 'manuel');
    if (result.warning) setGpsFeedback({ variant: 'warning', message: t('form.gpsZone') });
    else if (result.swapped) setGpsFeedback({ variant: 'info', message: t('form.gpsSwapped') });
    else setGpsFeedback(null);
    return true;
  }, [refs.parametres.gps_bbox, set, t]);
  const locate = () => {
    if (!window.isSecureContext) return;
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        set('gps', { lat: Number(position.coords.latitude.toFixed(6)), lng: Number(position.coords.longitude.toFixed(6)) });
        set('gps_text', `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
        set('gps_source', 'appareil');
        set('gps_precision_m', Math.max(0, Math.round(position.coords.accuracy || 0)));
      },
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
        setForm({ ...emptyForm(), ...keep }); manualFields.current.clear(); setFiles([]); setMatches([]); setForceDuplicate(false); window.scrollTo({ top: 0 });
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
  const duplicateGeo = useMemo(() => nearby.find((item) => item.statut !== 'traite'
    && item.distance_m <= Number(refs.parametres.rayon_doublon_m || 50)
    && item.id !== dismissedGeo) || null, [dismissedGeo, nearby, refs.parametres.rayon_doublon_m]);
  const applySuggestion = () => {
    if (!geoSuggestion?.commune_id) return;
    set('daira_id', String(geoSuggestion.daira_id));
    set('commune_id', String(geoSuggestion.commune_id));
  };
  const useExif = () => {
    if (!exifProposal) return;
    set('gps', { lat: Number(exifProposal.lat.toFixed(6)), lng: Number(exifProposal.lng.toFixed(6)) });
    set('gps_text', `${exifProposal.lat.toFixed(6)}, ${exifProposal.lng.toFixed(6)}`);
    set('gps_source', 'exif'); set('gps_precision_m', exifProposal.precision); setExifProposal(null);
  };
  const removeSmart = (kind, item) => {
    setForm((current) => {
      const next = { ...current };
      if (kind === 'urls' && item.type === 'social' && current.lien_url === item.normalise && !manualFields.current.has('lien_url')) {
        next.lien_url = ''; next.plateforme = 'autre'; next.contenu_type = null;
      }
      if (kind === 'dates' && item.estimee && current.date_publication === item.date && !manualFields.current.has('date_publication')) {
        next.date_publication = ''; next.date_publication_estimee = 0;
      }
      return next;
    });
  };
  if (loading) return <div className="page-container"><LoadingBlock /></div>;
  if (setup?.referentielTerritorialVide) return <div className="page-container"><PageHeader title={t('form.newTitle')} /><Alert variant="danger" title={t('form.noTerritory')} action={user.role === 'admin' ? <Button onClick={() => navigate('/assistant')}>{t('form.configure')}</Button> : null}>{user.role === 'admin' ? t('setup.intro') : t('form.contactAdmin')}</Alert></div>;
  return <div className="page-container pb-28"><PageHeader title={editing ? t('form.editTitle') : t('form.newTitle')} />{!editing && <SmartPasteZone ref={smartRef} bbox={refs.parametres.gps_bbox} onApply={applySmart} onFiles={handleFiles} onRemove={removeSmart} onPlaceMap={() => document.getElementById('gps-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />}{errors.form && <Alert variant="danger" className="mb-5" title={errors.form} action={editing && <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>{t('common.refresh')}</Button>}><AlertTriangle className="h-4 w-4" /></Alert>}<div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><SourceSection form={form} set={set} errors={errors} duplicate={duplicateAlert} /><ClassificationSection form={form} set={set} errors={errors} refs={refs} lang={lang} /><LocationSection form={form} set={set} errors={errors} refs={refs} lang={lang} gpsInfo={{ parse: parseCoordinates, message: gpsFeedback?.message, variant: gpsFeedback?.variant }} locate={locate} secure={window.isSecureContext} nearby={nearby} focusGeometry={focusGeometry} suggestion={geoSuggestion} onSuggestion={applySuggestion} duplicateGeo={duplicateGeo} onDifferent={() => setDismissedGeo(duplicateGeo?.id)} onLinkRepeat={() => { set('lie_a_id', duplicateGeo?.id || null); setDismissedGeo(duplicateGeo?.id); }} /><ProcessingSection form={form} set={set} errors={errors} refs={refs} lang={lang} /><NotesSection form={form} set={set} files={files} onFiles={handleFiles} exifProposal={exifProposal} exifMessage={exifMessage} onUseExif={useExif} /></div><div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--glass)] p-3 backdrop-blur-md md:start-auto"><div className="mx-auto flex max-w-[1480px] flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => navigate(-1)}><X className="h-4 w-4" />{t('common.cancel')}</Button><Button variant="secondary" loading={saving} onClick={() => save(false)}><Save className="h-4 w-4" />{t('common.save')}</Button>{!editing && <Button loading={saving} onClick={() => save(true)}>{t('common.saveNew')}</Button>}</div></div></div>;
}
