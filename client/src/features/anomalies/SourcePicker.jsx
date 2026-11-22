import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMPTE_SOCIAL_TYPES, natureSuggeree, nomSuggere } from '@anm/shared';
import { api, queryString } from '../../api/client.js';
import { Alert, Button, Combobox, Input, Select, Textarea, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';

const lireRecents = (key) => {
  try { return (JSON.parse(localStorage.getItem(key) || '[]') || []).filter(Number).slice(0, 8); }
  catch { return []; }
};
const libelleCommune = (source, lang) => (lang === 'ar' ? source.commune_ar : source.commune_fr) || source.commune_libelle || '—';

/** V14 — sélection de la page depuis l'URL, sans scraping ni écriture silencieuse. */
export default function SourcePicker({ model }) {
  const { state, set, autofill, user: formUser } = model;
  const { user: authUser } = useAuth();
  const { t, lang } = useI18n();
  const { push } = useToast();
  const values = state.values;
  const userId = authUser?.id || formUser?.id;
  const cleRecents = `anm-recent-sources-${userId}`;
  const recents = useRef(lireRecents(cleRecents));
  const choixManuel = useRef(Boolean(values.source_reseau_id));
  const selectedRef = useRef(String(values.source_reseau_id || ''));
  const dernierLien = useRef(values.lien_url);
  const sequence = useRef(0);
  const suggested = useRef(new Set());

  const [sources, setSources] = useState([]);
  const [identite, setIdentite] = useState(null);
  const [message, setMessage] = useState('');
  const [detection, setDetection] = useState('idle');
  const [panneau, setPanneau] = useState(false);
  const [form, setForm] = useState({ nom: '', nature: 'page', page_url: '', observations: '' });
  const [remplacement, setRemplacement] = useState(null);
  const [supprimee, setSupprimee] = useState(null);
  const [confirmLien, setConfirmLien] = useState(false);
  const [erreurNom, setErreurNom] = useState(false);
  const [nonce, setNonce] = useState(0);

  const charger = useCallback(async (q = '', reseau = '') => {
    try {
      const query = queryString({ q, reseau, limit: 20, recents: recents.current.join(',') });
      const reponse = await api(`/reseaux/recherche${query}`);
      setSources(reponse.items || []);
    } catch { setSources([]); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const retenir = useCallback((id) => {
    recents.current = [Number(id), ...recents.current.filter((item) => Number(item) !== Number(id))].slice(0, 8);
    try { localStorage.setItem(cleRecents, JSON.stringify(recents.current)); } catch { /* stockage indisponible */ }
  }, [cleRecents]);

  const appliquer = useCallback((source, origine = 'auto') => {
    if (!source?.id) return;
    choixManuel.current = origine === 'manuel';
    selectedRef.current = String(source.id);
    set('source_reseau_id', String(source.id));
    if (!values.plateforme || values.plateforme === 'autre') set('plateforme', source.plateforme);
    retenir(source.id);
    setMessage(origine === 'ajout' ? 'added' : 'registered');
  }, [set, values.plateforme, retenir]);

  const suggererCommune = useCallback((source) => {
    if (!source?.commune_id || suggested.current.has(source.id)) return;
    suggested.current.add(source.id);
    autofill([
      { champ: 'daira_id', valeur: String(source.daira_id || ''), source: 'source', confiance: 'haute', suggestion: true },
      { champ: 'commune_id', valeur: String(source.commune_id), source: 'source', confiance: 'haute', suggestion: true },
    ], `source-${source.id}-${Date.now()}`);
  }, [autofill]);

  const ouvrirAjout = useCallback((identification) => {
    const nature = natureSuggeree(identification);
    setIdentite(identification);
    setForm({
      nom: identification ? nomSuggere(identification) : '',
      nature: nature && nature !== 'autre' ? nature : 'page',
      page_url: identification?.page_url || '', observations: '',
    });
    setErreurNom(false); setPanneau(true); setRemplacement(null);
  }, []);

  useEffect(() => {
    const url = String(values.lien_url || '').trim();
    if (!url) { setIdentite(null); setMessage(''); return undefined; }
    const changement = dernierLien.current && dernierLien.current !== url;
    dernierLien.current = url;
    if (changement && selectedRef.current && !confirmLien) { setConfirmLien(true); return undefined; }
    const seq = ++sequence.current;
    const controller = new AbortController();
    setDetection('loading');
    const timer = window.setTimeout(async () => {
      try {
        const reponse = await api('/reseaux/identifier', {
          method: 'POST', body: { url }, signal: controller.signal,
        });
        if (controller.signal.aborted || seq !== sequence.current) return;
        setIdentite(reponse);
        setSupprimee(reponse.supprimee || null);
        if (!reponse.supprimee) setRemplacement(null);
        charger('', reponse.reseau);
        if (reponse.correspondance) {
          if (!choixManuel.current) appliquer(reponse.correspondance);
          else if (String(reponse.correspondance.id) !== selectedRef.current) setRemplacement(reponse.correspondance);
          suggererCommune(reponse.correspondance);
          if (reponse.reseau !== reponse.correspondance.plateforme) setMessage('otherNetwork');
        } else if (reponse.supprimee) {
          setPanneau(false);
          setMessage('deleted');
        } else if (reponse.statut === 'identifie') {
          if (!choixManuel.current) { ouvrirAjout(reponse); setMessage('notFound'); }
        } else {
          setMessage('notIdentifiable');
        }
      } catch (error) {
        if (!controller.signal.aborted && error.name !== 'AbortError') setDetection('error');
      } finally { if (seq === sequence.current) setDetection('idle'); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [values.lien_url, nonce, charger, appliquer, suggererCommune, ouvrirAjout, confirmLien]);

  const options = useMemo(() => [
    ...sources.map((source) => ({
      value: String(source.id),
      label: source.nom || source.lien_url,
      description: `${t(`platform.${source.plateforme}`)} · ${source.categorie ? t(`social.type.${source.categorie}`) : ''} · ${libelleCommune(source, lang)}`,
      search: `${source.nom} ${source.lien_url} ${source.valeur_norm || ''} ${source.commune_fr || ''} ${source.commune_ar || ''}`,
    })),
    { value: '__add', label: t('v14.source.add') },
  ], [sources, t, lang]);

  const choisir = (value) => {
    if (value === '__add') { ouvrirAjout(null); return; }
    if (!value) { selectedRef.current = ''; set('source_reseau_id', ''); setMessage(''); return; }
    const source = sources.find((item) => String(item.id) === String(value));
    choixManuel.current = true;
    selectedRef.current = String(value);
    set('source_reseau_id', String(value));
    retenir(value);
    if (source) {
      setMessage('detected');
      if (source.plateforme && values.plateforme !== source.plateforme) setMessage('otherNetwork');
      suggererCommune(source);
    }
  };

  const enregistrerPage = async () => {
    if (!form.nom.trim()) { setErreurNom(true); return; }
    try {
      const reponse = await api('/reseaux/rapide', { method: 'POST', body: {
        reseau: identite?.reseau || 'autre',
        identifiants: identite?.identifiants || [],
        page_url: identite?.page_url || form.page_url,
        nom: form.nom.trim(), nature: form.nature,
        commune_id: values.commune_id || null, daira_id: values.daira_id || null,
        observations: form.observations,
      } });
      appliquer(reponse.item, 'ajout'); setPanneau(false); charger();
    } catch (error) {
      if (error.code === 'RESEAU_EXISTANT' && error.details?.item) {
        appliquer(error.details.item, 'ajout'); setPanneau(false); charger();
      } else push(error.message, 'danger');
    }
  };

  const supporterIdentifiant = async (source) => {
    try {
      for (const identifiant of identite?.identifiants || []) {
        await api(`/reseaux/${source.id}/identifiants`, { method: 'POST', body: identifiant });
      }
      appliquer(source, 'ajout'); setPanneau(false); charger();
    } catch (error) { push(error.message, 'danger'); }
  };

  const urlManuelle = async () => {
    if (!form.page_url.trim()) return;
    try {
      const reponse = await api('/reseaux/identifier', { method: 'POST', body: { url: form.page_url.trim() } });
      setIdentite(reponse);
      if (reponse.correspondance) { appliquer(reponse.correspondance, 'ajout'); setPanneau(false); }
      else if (reponse.statut === 'identifie') {
        setForm((precedent) => ({ ...precedent, nom: nomSuggere(reponse) || precedent.nom,
          nature: natureSuggeree(reponse) === 'autre' ? precedent.nature : natureSuggeree(reponse),
          page_url: reponse.page_url || precedent.page_url }));
      } else setMessage('notIdentifiable');
    } catch (error) { push(error.message, 'danger'); }
  };

  const restaurer = async () => {
    try {
      await api(`/reseaux-sociaux/${supprimee.id}/restaurer`, { method: 'POST', body: {} });
      appliquer(supprimee, 'ajout'); setSupprimee(null); setMessage('restored'); charger();
    } catch (error) { push(error.message, 'danger'); }
  };

  const sourceChoisie = sources.find((item) => String(item.id) === String(values.source_reseau_id));
  const nomSource = sourceChoisie?.nom || '';
  const communeSource = sourceChoisie ? libelleCommune(sourceChoisie, lang) : '—';

  return <div className="sm:col-span-2 min-w-0 space-y-3" data-testid="source-picker">
    <Combobox id="source_reseau_id" label={t('v14.source.label')} placeholder={t('v14.source.placeholder')}
      value={values.source_reseau_id || ''} options={options} onQueryChange={(q) => charger(q, identite?.reseau || '')}
      onChange={choisir} onBlur={() => charger('', identite?.reseau || '')} />
    {sourceChoisie && <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
      <span className="text-brand-text-700">{t('v14.source.registered', { nom: nomSource, commune: communeSource })}</span>
      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-text-700">{t(`platform.${sourceChoisie.plateforme}`)}</span>
      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-text-700">{sourceChoisie.categorie ? t(`social.type.${sourceChoisie.categorie}`) : ''}</span>
      <Button size="sm" variant="secondary" onClick={() => { choixManuel.current = true; document.getElementById('source_reseau_id')?.focus(); }}>{t('v14.source.change')}</Button>
    </div>}
    {message && <p className={`text-sm ${message === 'notIdentifiable' ? 'text-danger' : 'text-muted'}`} role="status" data-testid="source-message">
      {t(`v14.source.${message}`)}{detection === 'loading' ? ` ${t('v14.source.detecting')}` : ''}
    </p>}
    <p className="text-xs text-muted">{t('v14.source.optional')}</p>

    {confirmLien && <Alert variant="warning" title={t('v14.source.linkChanged')}>
      <div className="flex gap-2"><Button size="sm" onClick={() => { setConfirmLien(false); setNonce((n) => n + 1); }}>{t('v14.source.confirm')}</Button>
        <Button size="sm" variant="secondary" onClick={() => { setConfirmLien(false); dernierLien.current = values.lien_url; }}>{t('v14.source.cancel')}</Button></div>
    </Alert>}
    {supprimee && !panneau && <Alert variant="warning" title={t('v14.source.restore')}>
      <Button size="sm" onClick={restaurer}>{supprimee.nom}</Button>
    </Alert>}
    {remplacement && !panneau && <Alert variant="warning" title={t('v14.source.replace', { nom: remplacement.nom })}>
      <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { appliquer(remplacement, 'auto'); setRemplacement(null); }}>{t('v14.source.confirm')}</Button>
        <Button size="sm" variant="secondary" onClick={() => { setRemplacement(null); choixManuel.current = true; }}>{t('v14.source.keep')}</Button></div>
    </Alert>}

    {panneau && <div data-testid="source-add-panel" className="min-w-0 space-y-3 rounded-md border border-border bg-surface2 p-4">
      <h3 className="text-sm font-bold">{identite ? t('v14.source.notFound') : t('v14.source.add')}</h3>
      {identite && <p className="text-xs text-muted"><bdi>{identite.reseau}</bdi> · {identite.identifiants?.map((item) => `${item.type}: ${item.valeur}`).join(', ')}</p>}
      <Input id="source_page_url" label={t('v14.source.pageUrl')} value={form.page_url}
        onChange={(event) => setForm((prev) => ({ ...prev, page_url: event.target.value }))} />
      {!identite && <Button size="sm" variant="secondary" onClick={urlManuelle}>{t('v14.source.detecting')}</Button>}
      <Input id="source_nom" label={t('v14.source.name')} required value={form.nom} error={erreurNom ? t('v14.source.name') : undefined}
        onChange={(event) => { setErreurNom(false); setForm((prev) => ({ ...prev, nom: event.target.value })); }} />
      <Select id="source_nature" label={t('v14.source.nature')} value={form.nature} options={COMPTE_SOCIAL_TYPES.map((value) => ({
        value, label: t(`social.type.${value}`), disabled: value === 'profil' && authUser?.role !== 'admin',
      }))} onChange={(event) => setForm((prev) => ({ ...prev, nature: event.target.value }))} />
      {authUser?.role !== 'admin' && <p className="text-xs text-muted">{t('v14.source.profilDisabled')}</p>}
      <Textarea id="source_notes" label={t('v14.source.notes')} rows={2} value={form.observations}
        onChange={(event) => setForm((prev) => ({ ...prev, observations: event.target.value }))} />
      {identite?.similaires?.length > 0 && <Alert variant="warning" title={t('v14.source.similar')}>
        {identite.similaires.slice(0, 3).map((source) => <div key={source.id} className="flex flex-wrap gap-2 py-1">
          <bdi className="min-w-0 flex-1">{source.nom}</bdi>
          <Button size="sm" onClick={() => supporterIdentifiant(source)}>{t('v14.source.useIdentifier', { nom: source.nom })}</Button>
        </div>)}
      </Alert>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={enregistrerPage}>{t('v14.source.saveSelect')}</Button>
        <Button size="sm" variant="secondary" onClick={() => { setPanneau(false); setMessage(''); }}>{t('v14.source.continueWithout')}</Button>
      </div>
    </div>}
  </div>;
}
