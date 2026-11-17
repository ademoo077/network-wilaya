/**
 * Page de synthèse V8.2 : #/syntheses/:id
 * Deux modes : Lecture (feuille temps réel ou figée) et Personnaliser
 * (éditeur de blocs, galerie, undo/redo, autosave, éditions figées, exports).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, ShieldAlert } from 'lucide-react';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Button, EmptyState, ErrorState, Skeleton, useToast } from '../../components/ui/index.js';
import { useSyntheseEditor, flattenBlocs } from './useSyntheseEditor.js';
import SyntheseCanvas from './SyntheseCanvas.jsx';
import { BlocInspectorDrawer, EditionDialog, EditionsDrawer, WidgetGalleryDrawer } from './SyntheseDrawers.jsx';
import { createPrintSettings, OfficialPrintDocument, PrintCustomizer } from './PrintCustomizer.jsx';

const MAX_WIDGETS = 60;

function blocId() {
  if (globalThis.crypto?.randomUUID) return `bloc-${globalThis.crypto.randomUUID()}`;
  return `bloc-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function nouveauBloc(item) {
  return {
    id: blocId(),
    type: item.visuel,
    titre: null,
    ...(item.requete ? { requete: JSON.parse(JSON.stringify(item.requete)) } : {}),
    ...(item.options ? { options: JSON.parse(JSON.stringify(item.options)) } : {}),
  };
}

function titreBloc(bloc, item, lang) {
  if (bloc.titre) return bloc.titre;
  if (item) return lang === 'ar' ? item.titre_ar : item.titre_fr;
  return typeLabel(bloc.type, lang);
}

function typeLabel(type, lang) {
  const map = { kpi: 'Indicateur', tableau: 'Tableau', barres: 'Barres', courbe: 'Courbe', anneau: 'Anneau', histogramme: 'Histogramme', texte: 'Texte', signature: 'Signature', separateur: 'Séparateur', legende: 'Légende', annexe: 'Annexe' };
  return (lang === 'ar' ? 'عنصر' : map[type]) || type;
}

export default function SynthesePage({ modeleId: modeleIdOverride, embedded = false, periodeOverride = null, modeleHref = null,
  displayWidth = null, onDisplayWidth = null, registerActions = null, onStudioState = null } = {}) {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const modeleId = Number(modeleIdOverride ?? routeId);
  const personnaliserAsked = searchParams.get('personnaliser') === '1';
  const sourceId = searchParams.get('source') ? Number(searchParams.get('source')) : null;
  const validModeleId = Number.isInteger(modeleId) && modeleId > 0;
  const canWrite = user && (user.role === 'admin' || user.role === 'operateur');
  const { push } = useToast();

  const modeleQuery = useApiQuery(`/syntheses/modeles/${modeleId}`, {
    enabled: validModeleId,
    placeholderData: undefined,
  });
  const [modele, setModele] = useState(null);
  const remoteModele = modeleQuery.data?.item || null;
  useEffect(() => {
    if (!remoteModele) return;
    setModele((current) => {
      if (!current || current.id !== remoteModele.id) return remoteModele;
      return Number(remoteModele.version) > Number(current.version) ? remoteModele : current;
    });
  }, [remoteModele]);
  const [mode, setMode] = useState(personnaliserAsked ? 'personnaliser' : 'lecture');
  const [openGalerie, setOpenGalerie] = useState(false);
  const [openInspector, setOpenInspector] = useState(false);
  const [openEditions, setOpenEditions] = useState(false);
  const [selectedBloc, setSelectedBloc] = useState(null);
  const [periode, setPeriode] = useState(periodeOverride || { mode: 'semaine', debut: '', fin: '' });
  const [snapshotEdition, setSnapshotEdition] = useState(null);
  const [frozenEditionId, setFrozenEditionId] = useState(null);
  const [galerieQuery, setGalerieQuery] = useState('');
  const [editionBusy, setEditionBusy] = useState(false);
  const periodeOverrideKey = JSON.stringify(periodeOverride);
  const [printOpen, setPrintOpen] = useState(false);
  const [localWidth, setLocalWidth] = useState('large');
  const defaultWidthRef = useRef(null);
  const activeWidth = displayWidth || localWidth;
  const [printSettings, setPrintSettings] = useState(() => createPrintSettings({ modele: null, periode: periodeOverride, user, t }));

  useEffect(() => {
    if (embedded || !remoteModele?.id) return;
    if (remoteModele.cle_systeme === 'hebdomadaire') {
      if (defaultWidthRef.current !== remoteModele.id) {
        defaultWidthRef.current = remoteModele.id;
        setLocalWidth('max');
      }
    } else {
      defaultWidthRef.current = null;
    }
  }, [embedded, remoteModele?.id, remoteModele?.cle_systeme]);

  useEffect(() => { if (periodeOverride) setPeriode(periodeOverride); }, [periodeOverrideKey, periodeOverride]);

  useEffect(() => {
    setModele((current) => current?.id === modeleId ? current : null);
    setMode(personnaliserAsked ? 'personnaliser' : 'lecture');
    setSnapshotEdition(null);
    setFrozenEditionId(null);
    setOpenGalerie(false);
    setOpenInspector(false);
    setOpenEditions(false);
  }, [modeleId, personnaliserAsked]);

  const editor = useSyntheseEditor(modele, setModele, { periode: periodeOverride });
  const definition = editor.currentDefinition;
  const blocs = flattenBlocs(definition);
  const alreadyFrozen = frozenEditionId ? editor.editions.find((e) => e.id === frozenEditionId)?.statut === 'fige' : false;
  const brouillon = mode === 'personnaliser' && !alreadyFrozen;

  const canPersonnaliser = canWrite && modele && (modele.portee === 'systeme' || modele.modifiable);
  const peutFiger = canWrite && modele && (modele.portee === 'systeme' || modele.modifiable) && !alreadyFrozen;

  useEffect(() => {
    if (modele) setPrintSettings(createPrintSettings({ modele, periode: periodeOverride || periode, user, t }));
    // Une nouvelle synthèse ou semaine repart d'une fiche d'impression cohérente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modele?.id, periodeOverrideKey, user?.full_name, lang]);
  const hrefForModele = useCallback((targetId, options = {}) => {
    if (modeleHref) return modeleHref(targetId, options);
    const query = new URLSearchParams();
    if (options.personnaliser) query.set('personnaliser', '1');
    if (options.source) query.set('source', String(options.source));
    return `/syntheses/${targetId}${query.size ? `?${query}` : ''}`;
  }, [modeleHref]);

  const handlePersonnaliser = useCallback(async () => {
    if (!modele) return;
    if (mode === 'personnaliser') {
      setMode('lecture');
      return;
    }
    if (modele.portee === 'systeme') {
      try {
        const copie = await editor.personnaliser(modele);
        navigate(hrefForModele(copie.id, { personnaliser: true, source: copie.source_modele_id || modele.id }));
      } catch (error) { push(error.message || t('common.error'), 'danger'); }
      return;
    }
    setMode('personnaliser');
  }, [modele, mode, editor, hrefForModele, navigate, push, t]);

  const handleReinitialiser = useCallback(async () => {
    if (!modele || !sourceId) return;
    try {
      const suite = await editor.reinitialiser(modele.id, sourceId);
      setModele(suite);
      setMode('lecture');
      push(t('synthese.reinitialisee'), 'success');
    } catch (error) { push(error.message || t('common.error'), 'danger'); }
  }, [modele, sourceId, editor, push, t]);

  const handleAddBloc = useCallback((item) => {
    if (!modele) return;
    const sectionId = definition.sections[0]?.id;
    if (!sectionId) return;
    if (blocs.length >= MAX_WIDGETS) { push(t('synthese.tropDeWidgets', { max: MAX_WIDGETS }), 'danger'); return; }
    const bloc = nouveauBloc(item);
    if (!bloc.titre) bloc.titre = titreBloc(bloc, item, lang);
    editor.addBloc(sectionId, bloc);
    setOpenGalerie(false);
  }, [modele, definition, blocs, editor, push, t, lang]);

  const handleSave = useCallback(async () => {
    try { await editor.save(); }
    catch { /* erreur affichée par l’éditeur */ }
  }, [editor]);

  const handleFiger = useCallback(async () => {
    if (!modele || editionBusy) return;
    setEditionBusy(true);
    try {
      const edition = await editor.createEdition(periode, []);
      const figee = await editor.figereEdition(edition.id);
      setFrozenEditionId(figee.id);
      setMode('lecture');
    } catch (error) { push(error.message || t('common.error'), 'danger'); }
    finally { setEditionBusy(false); }
  }, [modele, editionBusy, editor, periode, push, t]);

  const handleOpenEditions = useCallback(async () => {
    setOpenEditions(true);
    try { await editor.loadEditions(); }
    catch (error) { push(error.message || t('common.error'), 'danger'); }
  }, [editor, push, t]);

  const handleGenererEdition = useCallback(async () => {
    if (editionBusy) return;
    setEditionBusy(true);
    try {
      await editor.createEdition(periode, []);
      setFrozenEditionId(null);
      push(t('synthese.editionGeneree'), 'success');
    } catch (error) { push(error.message || t('common.error'), 'danger'); }
    finally { setEditionBusy(false); }
  }, [editionBusy, editor, periode, push, t]);

  const handleOpenEdition = useCallback(async (editionId) => {
    try {
      const edition = await editor.getEdition(editionId);
      setSnapshotEdition(edition);
      setMode('lecture');
      setOpenEditions(false);
    } catch (error) { push(error.message || t('common.error'), 'danger'); }
  }, [editor, push, t]);

  const handleFreezeEdition = useCallback(async (editionId) => {
    try {
      await editor.figereEdition(editionId);
      setFrozenEditionId(editionId);
    } catch (error) { push(error.message || t('common.error'), 'danger'); }
  }, [editor, push, t]);

  const handleBlocPatch = useCallback((patch) => {
    if (!selectedBloc) return;
    editor.setBloc(selectedBloc.id, patch);
    setSelectedBloc((current) => current ? { ...current, ...patch } : current);
  }, [editor, selectedBloc]);

  const handlePrint = useCallback(() => {
    setPrintOpen(false);
    const previousTitle = document.title;
    document.title = printSettings.title || previousTitle;
    window.addEventListener('afterprint', () => { document.title = previousTitle; }, { once: true });
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }, [printSettings.title]);

  // Le studio unifié expose les actions de cette feuille dans sa barre d'outils unique.
  useEffect(() => {
    if (!registerActions) return;
    registerActions({ personnaliser: handlePersonnaliser, figer: handleFiger, print: () => setPrintOpen(true) });
  }, [registerActions, handlePersonnaliser, handleFiger]);
  useEffect(() => {
    if (!onStudioState) return;
    onStudioState({
      canPersonnaliser: Boolean(canPersonnaliser),
      peutFiger: Boolean(peutFiger),
      alreadyFrozen: Boolean(alreadyFrozen),
      mode,
      busy: Boolean(editionBusy || editor.saving || editor.evaluating),
    });
  }, [onStudioState, canPersonnaliser, peutFiger, alreadyFrozen, mode, editionBusy, editor.saving, editor.evaluating]);

  const snapshotBlocs = useMemo(() => snapshotEdition?.snapshot?.blocs || [], [snapshotEdition]);
  const activeBlocs = snapshotEdition ? snapshotBlocs : blocs;
  const activeResults = useMemo(() => {
    const out = {};
    if (snapshotEdition) {
      for (const bloc of snapshotBlocs) if (bloc.resultat) out[bloc.id] = bloc.resultat;
    } else {
      Object.assign(out, editor.results);
    }
    return out;
  }, [snapshotEdition, snapshotBlocs, editor.results]);

  return (
    <main className={`page-container grid ${embedded ? 'px-2 py-4 sm:px-3' : 'min-h-dvh'}`} data-synthese-page data-synthese-state={snapshotEdition ? 'edition' : mode === 'personnaliser' ? 'personnalisation' : 'lecture'} aria-busy={editor.evaluating || undefined}>
      {brouillon && <div className="no-print fixed inset-0 z-[50] pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] text-[8vw] text-brand-100/10 font-black select-none">BROUILLON</div>
      </div>}
      <div className="flex min-w-0 flex-col h-full">
        {!embedded && <div className="no-print"><PageHeader
          eyebrow={t('synthese.eyebrow')}
          title={modele ? modele.nom : t('synthese.chargement')}
          description={t('synthese.subtitle')}
          actions={
            <>
              <label className="sr-only" htmlFor="synthese-width">{t('report.studio.displayWidth')}</label>
              <select id="synthese-width" value={activeWidth} onChange={(event) => setLocalWidth(event.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-xs font-bold text-ink">
                <option value="large">{t('report.studio.widthLarge')}</option>
                <option value="print">{t('report.studio.widthPrint')}</option>
                <option value="max">{t('report.studio.widthMax')}</option>
              </select>
              {canPersonnaliser && <Button size="sm" onClick={handlePersonnaliser}>
                {mode === 'personnaliser' ? (alreadyFrozen ? t('synthese.modeLecture') : t('synthese.quitterPersonnalisation')) : t('synthese.personnaliser')}
              </Button>}
              {modele && peutFiger && !alreadyFrozen && <Button size="sm" variant="secondary" onClick={handleFiger} loading={editionBusy} disabled={editor.saving || editor.evaluating || editionBusy}>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />{t('synthese.figer')}
              </Button>}
              <Button size="sm" variant="ghost" onClick={() => setPrintOpen(true)}>
                <Printer className="h-4 w-4" aria-hidden="true" />{t('common.imprimer')}
              </Button>
            </>
          }
        /></div>}
        <div className={`flex-1 overflow-auto ${activeWidth === 'max' ? 'p-1 sm:p-2' : embedded ? 'p-2 sm:p-3' : 'p-4 sm:p-6 lg:p-8'}`}>
          {!embedded && <Button size="sm" variant="ghost" className="mb-3" onClick={() => navigate('/syntheses')}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('common.back')}
          </Button>}
          {!validModeleId && <EmptyState title={t('synthese.modeleIntrouvable')} description={t('synthese.modeleIntrouvableHelp')} />}
          {validModeleId && modeleQuery.isError && <ErrorState message={modeleQuery.error?.message || t('error.load')} onRetry={() => modeleQuery.refetch()} />}
          {validModeleId && modeleQuery.isSuccess && !remoteModele && <EmptyState title={t('synthese.modeleIntrouvable')} description={t('synthese.modeleIntrouvableHelp')} />}
          {validModeleId && modeleQuery.isPending && !modele && <div className="grid place-items-center min-h-[40vh]"><Skeleton className="h-10 w-48" /></div>}
          {modele && <div className={`mx-auto w-full ${activeWidth === 'print' ? 'max-w-[794px]' : activeWidth === 'max' ? 'max-w-none' : 'max-w-[1280px]'}`} data-display-width={activeWidth}>
            <OfficialPrintDocument settings={printSettings} t={t} lang={lang}><SyntheseCanvas modele={modele} mode={mode} sourceId={sourceId} alreadyFrozen={alreadyFrozen} editor={editor} blocs={blocs} activeBlocs={activeBlocs} activeResults={activeResults} maxWidgets={MAX_WIDGETS} t={t} lang={lang} dir={dir} typeLabel={typeLabel}
              onAdd={() => setOpenGalerie(true)} onSave={handleSave} onReset={handleReinitialiser} onOpenEditions={handleOpenEditions}
              onPrint={() => setPrintOpen(true)}
              onPreview={() => (embedded && onDisplayWidth ? onDisplayWidth('print') : setLocalWidth('print'))}
              onEdit={(bloc) => { setSelectedBloc(bloc); setOpenInspector(true); }} onVoirFiches={() => { navigate('/anomalies'); push(t('synthese.voirFichesInfo'), 'success'); }} embedded={embedded} /></OfficialPrintDocument>
          </div>}
        </div>
      </div>

      <WidgetGalleryDrawer open={openGalerie} onClose={() => setOpenGalerie(false)} query={galerieQuery} onQuery={setGalerieQuery} onAdd={handleAddBloc} t={t} lang={lang} />
      <BlocInspectorDrawer open={openInspector} onClose={() => { setOpenInspector(false); setSelectedBloc(null); }} bloc={selectedBloc} onPatch={handleBlocPatch} typeLabel={typeLabel} t={t} lang={lang} />
      <EditionsDrawer open={openEditions} onClose={() => setOpenEditions(false)} periode={periode} onPeriode={setPeriode} editor={editor} busy={editionBusy} canFreeze={peutFiger} onGenerate={handleGenererEdition} onOpen={handleOpenEdition} onFreeze={handleFreezeEdition} t={t} lang={lang} />
      <EditionDialog edition={snapshotEdition} blocs={snapshotBlocs} onClose={() => setSnapshotEdition(null)} t={t} lang={lang} dir={dir} />
      <PrintCustomizer open={printOpen} settings={printSettings} onChange={setPrintSettings} onClose={() => setPrintOpen(false)} onPrint={handlePrint}
        onReset={() => setPrintSettings(createPrintSettings({ modele, periode: periodeOverride || periode, user, t }))}
        blocs={activeBlocs} t={t} lang={lang} />
    </main>
  );
}

export { nouveauBloc, blocId };
