import { useState } from 'react';
import { Download, Save, X, Plus, Trash2 } from 'lucide-react';
import {
  BLOC_TYPES, GALERIE, formatDateShort, MEASURES, CATALOGUE,
  COLONNES_PRESETS, COLONNE_PRIORITES, appliquerPresetColonnes, colonnesDisponibles, colonnesDuBloc,
  normaliserStyle, proprietesPourBloc, getByPath, setByPath,
} from '@anm/shared';
import {
  Button, Card, Dialog, Drawer, Input, Select, SegmentedControl, Skeleton, Textarea, Checkbox,
} from '../../components/ui/index.js';
import { Chip } from '../../components/ui/Chip.jsx';
import WidgetCard from './WidgetCard.jsx';
import ColorPicker from './ColorPicker.jsx';

const COMPARAISON_OPTIONS = [
  { value: 'aucune', labelFr: 'Aucune', labelAr: 'لا شيء' },
  { value: 'periode_precedente', labelFr: 'Période précédente', labelAr: 'الفترة السابقة' },
  { value: 'meme_periode_n-1', labelFr: 'Même période n−1', labelAr: 'نفس الفترة من السنة الماضية' },
  { value: 'moyenne_4', labelFr: 'Moyenne 4 périodes', labelAr: 'متوسط 4 فترات' },
  { value: 'periode_libre', labelFr: 'Période libre', labelAr: 'فترة مخصصة' },
];

const GESTION_MESURES = [
  { group: 'cohorte', labelFr: 'Cohorte', labelAr: 'الدفعة', ids: ['recues', 'cohorte_non_traitees', 'cohorte_en_cours', 'cohorte_traitees', 'cohorte_pct_non_traitees', 'cohorte_pct_en_cours', 'cohorte_pct_traitees', 'taux_traitement'] },
  { group: 'traitement', labelFr: 'Traitement', labelAr: 'المعالجة', ids: ['traitees_periode', 'taux_sla', 'nb_hors_sla', 'delai_moyen', 'delai_median', 'delai_p90', 'delai_min', 'delai_max'] },
  { group: 'verification', labelFr: 'Classement', labelAr: 'التصنيف', ids: ['taux_confirmation', 'taux_infirmation', 'delai_verification_moyen'] },
  { group: 'intervention', labelFr: 'Intervention', labelAr: 'التدخل', ids: ['delai_intervention_moyen'] },
  { group: 'stock', labelFr: 'Stock', labelAr: 'المخزون', ids: ['stock_fin', 'stock_debut', 'variation_stock', 'taux_traitement_cumule', 'age_moyen_stock', 'age_max_stock', 'en_retard', 'urgentes_ouvertes'] },
  { group: 'qualite', labelFr: 'Qualité', labelAr: 'الجودة', ids: ['taux_geolocalisation', 'taux_gps_confirme', 'nb_liens_distincts', 'nb_communes_touchees', 'nb_dairas_touchees', 'nb_recurrents', 'indice_recurrence'] },
  { group: 'derivee', labelFr: 'Dérivées', labelAr: 'مشتقة', ids: ['pct_du_total', 'rang', 'pct_cumule'] },
];



function KpiMesuresSelector({ mesures, onChange, t, lang }) {
  const [openSection, setOpenSection] = useState(null);
  const [query, setQuery] = useState('');
  const norm = query.trim().toLowerCase();
  const filtered = norm
    ? MEASURES.filter((m) => m.label_fr.toLowerCase().includes(norm) || m.label_ar.includes(norm))
    : null;
  const active = new Set(mesures.map((m) => m.id));

  const toggle = (id) => {
    if (active.has(id)) onChange(mesures.filter((m) => m.id !== id));
    else if (mesures.length < 24) onChange([...mesures, { id }]);
  };

  const reorder = (from, to) => {
    const next = [...mesures];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return <div className="grid gap-3" data-kpi-mesures-selector>
    <Input placeholder={t('synthese.mesuresSearch')} value={query} onChange={(e) => setQuery(e.target.value)} />

    {filtered ? (
      <div className="flex flex-wrap gap-2">
        {filtered.map((m) => (
          <button key={m.id} type="button" data-kpi-measure={m.id}
            onClick={() => toggle(m.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold transition ${active.has(m.id) ? 'border-brand-600 bg-brand-100 text-brand-800' : 'border-border bg-surface2 text-ink2 hover:border-brand-400'}`}>
            {active.has(m.id) ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            <bdi>{lang === 'ar' ? m.label_ar : m.label_fr}</bdi>
          </button>
        ))}
      </div>
    ) : (
      <div className="grid gap-2">
        {GESTION_MESURES.map((section) => (
          <div key={section.group} className="rounded-lg border border-border">
            <button type="button" data-kpi-group={section.group} className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-ink2 hover:bg-surface2"
              onClick={() => setOpenSection(openSection === section.group ? null : section.group)}>
              <span><bdi>{lang === 'ar' ? section.labelAr : section.labelFr}</bdi></span>
              <span className="text-[11px]">{section.ids.filter((id) => active.has(id)).length}/{section.ids.length}</span>
            </button>
            {openSection === section.group && <div className="grid grid-cols-2 gap-1 px-2 pb-2">
              {section.ids.map((id) => {
                const m = MEASURES.find((x) => x.id === id);
                if (!m) return null;
                const isOn = active.has(id);
                return <button key={id} type="button" data-kpi-measure={id}
                  onClick={() => toggle(id)}
                  disabled={!isOn && mesures.length >= 24}
                  className={`flex items-center gap-1 rounded px-2 py-1.5 text-start text-xs transition disabled:opacity-40 ${isOn ? 'bg-brand-100 font-bold text-brand-800' : 'text-ink2 hover:bg-surface2'}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${isOn ? 'bg-brand-600' : 'bg-border'}`} />
                  <bdi>{lang === 'ar' ? m.label_ar : m.label_fr}</bdi>
                </button>;
              })}
            </div>}
          </div>
        ))}
      </div>
    )}

    {mesures.length > 0 && <div className="mt-2">
      <p className="mb-1 text-xs font-bold text-ink2">{t('synthese.mesuresSelected', { n: mesures.length })}</p>
      <ol className="grid gap-1" data-kpi-mesures-list>
        {mesures.map((m, index) => {
          const meta = MEASURES.find((x) => x.id === m.id);
          return <li key={m.id} className="flex items-center gap-2 rounded-md border border-border bg-surface2 px-2 py-1.5">
            <span className="shrink-0 text-xs font-bold text-muted">{index + 1}</span>
            <bdi className="min-w-0 flex-1 truncate text-xs text-ink">{meta ? (lang === 'ar' ? meta.label_ar : meta.label_fr) : m.id}</bdi>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => reorder(index, index - 1)} disabled={index === 0}
                className="rounded p-1 text-muted hover:bg-border disabled:opacity-30" aria-label="Monter">↑</button>
              <button type="button" onClick={() => reorder(index, index + 1)} disabled={index === mesures.length - 1}
                className="rounded p-1 text-muted hover:bg-border disabled:opacity-30" aria-label="Descendre">↓</button>
              <button type="button" onClick={() => onChange(mesures.filter((x) => x.id !== m.id))}
                className="rounded p-1 text-danger hover:bg-surface2" aria-label="Supprimer"><Trash2 className="h-3 w-3" /></button>
            </div>
          </li>;
        })}
      </ol>
    </div>}
  </div>;
}

export function WidgetGalleryDrawer({ open, onClose, query, onQuery, onAdd, t, lang }) {
  const normalized = query.trim().toLowerCase();
  const items = GALERIE.filter((item) => !normalized || item.titre_fr.toLowerCase().includes(normalized) || item.titre_ar.includes(normalized));
  return <Drawer open={open} onClose={onClose} title={t('synthese.galerie')} width="max-w-3xl">
    <div className="grid gap-4">
      <Input placeholder={t('synthese.rechercherWidget')} value={query} onChange={(event) => onQuery(event.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <Button key={item.id} variant="ghost" size="sm" onClick={() => onAdd(item)} className="h-auto min-h-28 flex-col items-start gap-2 rounded-lg border border-border p-3 text-start hover:border-brand-500">
        <div className="flex w-full items-center justify-between gap-2"><span className="rounded bg-surface2 px-2 py-1 text-xs font-black text-ink2">{item.visuel.slice(0, 3).toUpperCase()}</span><Chip variant="secondaire">{item.famille}</Chip></div>
        <p className="font-bold text-ink"><bdi>{lang === 'ar' ? item.titre_ar : item.titre_fr}</bdi></p>
        <p className="line-clamp-2 text-xs font-normal text-muted">{item.description || ''}</p>
      </Button>)}</div>
    </div>
  </Drawer>;
}

export function ColonnesDrawer({ open, onClose, bloc, onPatch, t, lang, role }) {
  const [query, setQuery] = useState('');
  const disponibles = colonnesDisponibles(bloc, { role });
  const configured = colonnesDuBloc(bloc, { role });
  const byId = new Map(configured.map((column) => [column.id, column]));
  const filtered = disponibles.filter((column) => {
    const label = lang === 'ar' ? column.label_ar : column.label_fr;
    return !query || label.toLowerCase().includes(query.toLowerCase());
  });

  const update = (colonnes) => onPatch({ options: { ...bloc.options, colonnes } });
  const toggle = (column) => {
    if (byId.has(column.id)) update(configured.filter((item) => item.id !== column.id));
    else update([...configured, column]);
  };
  const patch = (id, changes) => update(configured.map((column) => column.id === id ? { ...column, ...changes } : column));
  const move = (index, delta) => {
    const next = [...configured];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };
  const preset = (key) => update(appliquerPresetColonnes(configured, COLONNES_PRESETS[key]));

  return <Drawer open={open} onClose={onClose} title={t('synthese.columns.title')} width="max-w-3xl">
    <div className="grid gap-4" data-columns-drawer>
      <p className="text-xs text-muted">{t('synthese.columns.subtitle')}</p>
      <div className="flex flex-wrap gap-2">
        {Object.keys(COLONNES_PRESETS).map((key) => <Button key={key} size="sm" variant="secondary" onClick={() => preset(key)}>
          {t(`synthese.columns.preset${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
        </Button>)}
      </div>
      <Input placeholder={t('synthese.columns.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
      {configured.length > 0 && <div className="grid gap-2" data-columns-selected>
        {configured.map((column, index) => <div key={column.id} className="rounded-lg border border-border bg-surface2 p-3" data-column-id={column.id}>
          <div className="mb-2 flex items-center gap-2">
            <bdi className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{lang === 'ar' ? column.label_ar : column.label_fr}</bdi>
            <Button size="sm" variant="ghost" aria-label={t('synthese.columns.up')} disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
            <Button size="sm" variant="ghost" aria-label={t('synthese.columns.down')} disabled={index === configured.length - 1} onClick={() => move(index, 1)}>↓</Button>
            <Button size="sm" variant="ghost" aria-label={t('synthese.columns.remove')} onClick={() => toggle(column)}>×</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select label={t('synthese.columns.format')} value={column.format} onChange={(event) => patch(column.id, { format: event.target.value })}
              options={Object.values(CATALOGUE.formats).map((format) => ({ value: format.id, label: lang === 'ar' ? format.label_ar : format.label_fr }))} />
            <Select label={t('synthese.columns.align')} value={column.align} onChange={(event) => patch(column.id, { align: event.target.value })}
              options={[{ value: 'left', label: 'Gauche' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Droite' }]} />
            <Select label={t('synthese.columns.priority')} value={column.priorite} onChange={(event) => patch(column.id, { priorite: event.target.value })}
              options={COLONNE_PRIORITES.map((p) => ({ value: p, label: p }))} />
            <Select label={t('synthese.columns.tri')} value={column.tri || ''} onChange={(event) => patch(column.id, { tri: event.target.value || null })}
              options={[{ value: '', label: '—' }, { value: 'asc', label: '↑' }, { value: 'desc', label: '↓' }]} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4">
            <Checkbox checked={column.visible_ecran !== false} onChange={(event) => patch(column.id, { visible_ecran: event.target.checked })}>{t('synthese.columns.visibleScreen')}</Checkbox>
            <Checkbox checked={column.visible_impression !== false} onChange={(event) => patch(column.id, { visible_impression: event.target.checked })}>{t('synthese.columns.visiblePrint')}</Checkbox>
            {column.source === 'mesure' && <Checkbox checked={Boolean(column.total)} onChange={(event) => patch(column.id, { total: event.target.checked })}>{t('synthese.total')}</Checkbox>}
          </div>
        </div>)}
      </div>}
      {filtered.length > 0 && <div className="grid gap-2">
        {filtered.map((column) => <button key={column.id} type="button" data-column-available={column.id} onClick={() => toggle(column)}
          className={`flex items-center justify-between rounded-md border px-3 py-2 text-start text-sm transition ${byId.has(column.id) ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-border bg-surface2 text-ink2 hover:border-brand-300'}`}>
          <bdi>{lang === 'ar' ? column.label_ar : column.label_fr}</bdi>
          <span className="text-xs font-bold">{byId.has(column.id) ? '✓' : '+'}</span>
        </button>)}
      </div>}
      {filtered.length === 0 && <p className="text-xs text-muted">{t('synthese.columns.empty')}</p>}
      <p className="text-xs text-muted">{t('synthese.columns.help')}</p>
      <div className="flex justify-end"><Button size="sm" onClick={onClose}>{t('common.appliquer')}</Button></div>
    </div>
  </Drawer>;
}

export function BlocInspectorDrawer({ open, onClose, bloc, onPatch, typeLabel, t, lang, role = 'operateur' }) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  if (!bloc) return null;
  const isKpi = bloc.type === 'kpi';
  const requete = bloc.requete || {};
  const mesures = requete.mesures || [];
  const comparaison = requete.comparaison || 'aucune';
  const objectifs = bloc.options?.objectifs || {};
  const seuils = bloc.options?.seuils || {};
  const filtres = requete.filtres || [];
  const periode = requete.periode || { mode: 'herite' };
  const style = normaliserStyle(bloc.options);
  const updateStyle = (patch) => onPatch({ options: { ...bloc.options, style: { ...style, ...patch } } });
  const propsRegistre = proprietesPourBloc(bloc);


  const updateRequete = (patch) => onPatch({ requete: { ...requete, ...patch } });
  const updateMesures = (next) => updateRequete({ mesures: next });
  const updateComparaison = (val) => updateRequete({ comparaison: val });
  const updateObjectif = (id, val) => onPatch({ options: { ...bloc.options, objectifs: { ...objectifs, [id]: val } } });
  const updateSeuil = (id, key, val) => onPatch({ options: { ...bloc.options, seuils: { ...seuils, [id]: { ...seuils[id], [key]: val } } } });
  const updateFiltre = (index, field, val) => {
    const next = filtres.map((f, i) => i === index ? { ...f, [field]: val } : f);
    updateRequete({ filtres: next });
  };
  const addFiltre = () => updateRequete({ filtres: [...filtres, { champ: 'domaine', op: 'is_null', valeur: false }] });
  const removeFiltre = (index) => updateRequete({ filtres: filtres.filter((_, i) => i !== index) });
  const updatePeriode = (patch) => updateRequete({ periode: { ...periode, ...patch } });

  return <>
    <Drawer open={open && !columnsOpen} onClose={onClose} title={t('synthese.inspecteur')} width="max-w-lg">
      <div className="grid gap-4">
        <Input label={t('synthese.titre')} value={bloc.titre || ''} onChange={(event) => onPatch({ titre: event.target.value })} />
        <Select label={t('synthese.visuel')} value={bloc.type} onChange={(event) => onPatch({ type: event.target.value })} options={BLOC_TYPES.map((type) => ({ value: type, label: typeLabel(type, lang) }))} />
        <div className="grid gap-4 sm:grid-cols-2"><Select label={t('synthese.widget.width')} value={bloc.options?.largeur || 'simple'} onChange={(event) => onPatch({ options: { ...bloc.options, largeur: event.target.value } })} options={[{ value: 'simple', label: t('synthese.widget.widthSimple') }, { value: 'double', label: t('synthese.widget.widthDouble') }, { value: 'pleine', label: t('synthese.widget.widthFull') }]} /><Select label={t('synthese.widget.height')} value={bloc.options?.hauteur || 'normale'} onChange={(event) => onPatch({ options: { ...bloc.options, hauteur: event.target.value } })} options={[{ value: 'compacte', label: t('synthese.widget.heightCompact') }, { value: 'normale', label: t('synthese.widget.heightNormal') }, { value: 'grande', label: t('synthese.widget.heightTall') }]} /></div>
        <Select label={t('synthese.widget.heightMode')} value={bloc.options?.hauteur_mode || 'auto'} onChange={(event) => onPatch({ options: { ...bloc.options, hauteur_mode: event.target.value } })} options={[{ value: 'auto', label: t('synthese.widget.heightAuto') }, { value: 'fixe', label: t('synthese.widget.heightFixed') }]} />
        {bloc.options?.hauteur_mode !== 'fixe' && <div className="grid gap-4 sm:grid-cols-2"><Input type="number" min="1" max="40" label={t('synthese.widget.heightMin')} value={bloc.options?.hauteur_min || 1} onChange={(event) => onPatch({ options: { ...bloc.options, hauteur_min: Number(event.target.value) } })} /><Input type="number" min="1" max="40" label={t('synthese.widget.heightMax')} value={bloc.options?.hauteur_max || 40} onChange={(event) => onPatch({ options: { ...bloc.options, hauteur_max: Number(event.target.value) } })} /></div>}
        <Select label={t('synthese.widget.printVisibility')} value={bloc.options?.masquer_impression ? 'masque' : 'visible'} onChange={(event) => onPatch({ options: { ...bloc.options, masquer_impression: event.target.value === 'masque' } })} options={[{ value: 'visible', label: t('synthese.widget.printVisible') }, { value: 'masque', label: t('synthese.widget.printHidden') }]} />
        {bloc.type === 'avant_apres' && <div className="grid gap-2 rounded-lg border border-border bg-surface2 p-3">
          <Input type="number" min="1" max="24" label={t('synthese.pairsPerPage')}
            value={bloc.options?.limite || 12}
            onChange={(event) => onPatch({ options: { ...bloc.options, limite: Math.min(24, Math.max(1, Number(event.target.value) || 1)) } })} />
          <p className="text-[11px] text-muted">{t('synthese.pairsPerPageHelp')}</p>
        </div>}
        {bloc.type === 'tableau' && <div className="flex justify-end"><Button size="sm" variant="secondary" onClick={() => setColumnsOpen(true)}>{t('synthese.columns.button')}</Button></div>}
        <hr className="border-border" />
        <div className="grid gap-4 rounded-lg border border-border bg-surface2 p-3">
          <p className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.style.title')}</p>
          <Select label={t('synthese.style.alignement')} value={style.alignement} onChange={(event) => updateStyle({ alignement: event.target.value })} options={[{ value: 'auto', label: t('synthese.style.alignAuto') }, { value: 'start', label: t('synthese.style.alignStart') }, { value: 'center', label: t('synthese.style.alignCenter') }, { value: 'end', label: t('synthese.style.alignEnd') }]} />
          <Select label={t('synthese.style.densite')} value={style.densite} onChange={(event) => updateStyle({ densite: event.target.value })} options={[{ value: 'normal', label: t('synthese.style.densiteNormal') }, { value: 'compact', label: t('synthese.style.densiteCompacte') }]} />
          <Select label={t('synthese.style.accent')} value={style.accent} onChange={(event) => updateStyle({ accent: event.target.value })} options={[{ value: 'none', label: t('synthese.style.accentNone') }, { value: 'brand', label: t('synthese.style.accentBrand') }, { value: 'warning', label: t('synthese.style.accentWarning') }, { value: 'danger', label: t('synthese.style.accentDanger') }, { value: 'info', label: t('synthese.style.accentInfo') }]} />
          <p className="text-[11px] text-muted">{t('synthese.style.help')}</p>
          <div className="grid gap-3 border-t border-border pt-3">
            <p className="text-xs font-bold text-ink2">Propriétés (V17)</p>
            {propsRegistre.filter((p) => p.type === 'text' && p.path !== 'titre').map((p) => (
              <Input key={p.id} label={p.label} value={getByPath(bloc, p.path) || ''} onChange={(e) => onPatch(setByPath(bloc, p.path, e.target.value))} />
            ))}
            {propsRegistre.filter((p) => p.type === 'color').map((p) => (
              <ColorPicker key={p.id} label={p.label} value={getByPath(bloc, p.path) || ''} contrastAgainst={style.fond || undefined}
                onChange={(v) => onPatch(setByPath(bloc, p.path, v))} />
            ))}
          </div>
        </div>
        {bloc.type === 'texte' && <div className="grid gap-4 rounded-lg border border-border bg-surface2 p-3">
          <p className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.contenuAr')}</p>
          <Textarea label={t('synthese.contenuAr')} value={bloc.options?.texte_ar || ''} onChange={(event) => onPatch({ options: { ...bloc.options, texte_ar: event.target.value } })} dir="rtl" />
        </div>}

      {isKpi && <>
        <hr className="border-border" />
        <div>
          <p className="mb-2 text-sm font-bold text-ink">{t('synthese.mesuresLabel')}</p>
          <KpiMesuresSelector mesures={mesures} onChange={updateMesures} t={t} lang={lang} />
        </div>
        <Select label={t('synthese.comparaison')} value={comparaison} onChange={(e) => updateComparaison(e.target.value)}
          options={COMPARAISON_OPTIONS.map((c) => ({ value: c.value, label: lang === 'ar' ? c.labelAr : c.labelFr }))} />
        <div>
          <p className="mb-2 text-sm font-bold text-ink">{t('synthese.periodeLabel')}</p>
          <SegmentedControl options={[
            { value: 'herite', label: t('synthese.periodeHerite') },
            { value: 'semaine', label: t('synthese.periodeSemaine') },
            { value: 'mois', label: t('synthese.periodeMois') },
            { value: 'plage', label: t('synthese.periodePlage') },
            { value: 'glissant', label: t('synthese.periodeGlissant') },
          ]} value={periode.mode} onChange={(mode) => updatePeriode({ mode })} />
          {periode.mode === 'plage' && <div className="mt-2 grid gap-3 sm:grid-cols-2"><Input type="date" label={t('synthese.debut')} value={periode.debut || ''} onChange={(e) => updatePeriode({ debut: e.target.value })} /><Input type="date" label={t('synthese.fin')} value={periode.fin || ''} onChange={(e) => updatePeriode({ fin: e.target.value })} /></div>}
          {periode.mode === 'glissant' && <div className="mt-2"><Input type="number" min="1" max="3660" label={t('synthese.jours')} value={periode.jours || 7} onChange={(e) => updatePeriode({ jours: Number(e.target.value) })} /></div>}
        </div>
        {mesures.length > 0 && <div>
          <p className="mb-2 text-sm font-bold text-ink">{t('synthese.objectifsSeuils')}</p>
          <div className="grid gap-2">
            {mesures.map((m) => {
              const meta = MEASURES.find((x) => x.id === m.id);
              if (!meta) return null;
              return <div key={m.id} className="grid gap-2 rounded-md border border-border p-2">
                <p className="text-xs font-bold text-ink2"><bdi>{lang === 'ar' ? meta.label_ar : meta.label_fr}</bdi></p>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.1" label={t('synthese.objectif')} value={objectifs[m.id] ?? ''} placeholder="—" onChange={(e) => updateObjectif(m.id, e.target.value === '' ? null : Number(e.target.value))} />
                  <Input type="number" step="0.1" label={t('synthese.seuilAlerte')} value={seuils[m.id]?.alerte ?? ''} placeholder="—" onChange={(e) => updateSeuil(m.id, 'alerte', e.target.value === '' ? null : Number(e.target.value))} />
                  <Input type="number" step="0.1" label={t('synthese.seuilCritique')} value={seuils[m.id]?.critique ?? ''} placeholder="—" onChange={(e) => updateSeuil(m.id, 'critique', e.target.value === '' ? null : Number(e.target.value))} />
                </div>
              </div>;
            })}
          </div>
        </div>}
        <div>
          <p className="mb-2 text-sm font-bold text-ink">{t('synthese.filtresLabel')}</p>
          {filtres.length === 0 && <p className="text-xs text-muted">{t('synthese.aucunFiltre')}</p>}
          {filtres.map((f, index) => <div key={index} className="mb-2 grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr,1fr,2fr,auto]">
            <Select value={f.champ} onChange={(e) => updateFiltre(index, 'champ', e.target.value)}
              options={CATALOGUE ? Object.values(CATALOGUE.filtres).map((x) => ({ value: x.id, label: lang === 'ar' ? x.label_ar : x.label_fr })) : []} />
            <Select value={f.op} onChange={(e) => updateFiltre(index, 'op', e.target.value)}
              options={[{ value: 'in', label: 'in' }, { value: 'not_in', label: 'not_in' }, { value: 'eq', label: 'eq' }, { value: 'is_null', label: 'is_null' }]} />
            <Input value={Array.isArray(f.valeur) ? f.valeur.join(', ') : String(f.valeur ?? '')} onChange={(e) => updateFiltre(index, 'valeur', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))} />
            <button type="button" onClick={() => removeFiltre(index)} className="self-end rounded p-2 text-danger hover:bg-surface2" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
          </div>)}
          <Button size="sm" variant="secondary" onClick={addFiltre}><Plus className="h-4 w-4" />{t('synthese.ajouterFiltre')}</Button>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-ink">{t('synthese.prereglages')}</p>
          <div className="flex flex-wrap gap-2">
            {['recues-kpi', 'taux-traitement-kpi', 'stock-fin-kpi', 'delai-moyen-kpi', 'taux-sla-kpi'].map((id) => {
              const item = GALERIE.find((g) => g.id === id);
              if (!item || !item.requete) return null;
              return <button key={id} type="button"
                onClick={() => onPatch({ requete: { ...item.requete }, titre: lang === 'ar' ? item.titre_ar : item.titre_fr, options: { ...bloc.options, ...item.options } })}
                className="rounded-full border border-border bg-surface2 px-3 py-1 text-xs font-bold text-ink2 hover:border-brand-400 hover:bg-brand-50">
                {lang === 'ar' ? item.titre_ar : item.titre_fr}
              </button>;
            })}
          </div>
        </div>
      </>}

      {bloc.type === 'texte' && <Textarea label={t('synthese.contenu')} value={bloc.options?.texte_fr || ''} onChange={(event) => onPatch({ options: { ...bloc.options, texte_fr: event.target.value } })} />}
      <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button size="sm" onClick={onClose}>{t('common.appliquer')}</Button></div>
    </div>
  </Drawer>
  <ColonnesDrawer open={columnsOpen} onClose={() => setColumnsOpen(false)} bloc={bloc} onPatch={onPatch} t={t} lang={lang} role={role} />
  </>;
}

export function EditionsDrawer({
  open, onClose, periode, onPeriode, editor, busy, canFreeze,
  onGenerate, onOpen, onFreeze, t, lang,
}) {
  return <Drawer open={open} onClose={onClose} title={t('synthese.editions')} width="max-w-3xl" side="start">
    <div className="grid gap-4">
      <Card className="grid gap-3 bg-surface2 p-4">
        <SegmentedControl options={[
          { value: 'semaine', label: t('synthese.periodeSemaine') },
          { value: 'mois', label: t('synthese.periodeMois') },
          { value: 'plage', label: t('synthese.periodePlage') },
        ]} value={periode.mode} onChange={(mode) => onPeriode({ ...periode, mode, debut: mode === 'plage' ? periode.debut : '', fin: mode === 'plage' ? periode.fin : '' })} />
        {periode.mode === 'plage' && <div className="grid gap-3 sm:grid-cols-2"><Input type="date" label={t('synthese.debut')} value={periode.debut} onChange={(event) => onPeriode({ ...periode, debut: event.target.value })} /><Input type="date" label={t('synthese.fin')} value={periode.fin} onChange={(event) => onPeriode({ ...periode, fin: event.target.value })} /></div>}
        <Button size="sm" onClick={onGenerate} loading={busy} disabled={editor.saving || busy}><Save className="h-4 w-4" aria-hidden="true" />{t('synthese.genererEdition')}</Button>
      </Card>
      {editor.editionsLoading && <Skeleton className="h-12 w-full" />}
      <div className="grid gap-2">{editor.editions.map((edition) => <Card key={edition.id} data-testid={`edition-${edition.id}`} className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="font-bold text-ink"><bdi>{edition.modele_nom || ''}</bdi></div><div className="text-xs text-muted">{formatDateShort(edition.periode.debut, lang)} → {formatDateShort(edition.periode.fin, lang)} · v{edition.version}</div><Chip variant={edition.statut === 'fige' ? 'secondaire' : 'outline'}>{edition.statut === 'fige' ? t('synthese.figee') : t('synthese.brouillon')}</Chip></div>
          <div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" onClick={() => onOpen(edition.id)}>{t('synthese.ouvrir')}</Button>{edition.statut !== 'fige' && canFreeze && <Button size="sm" onClick={() => onFreeze(edition.id)}>{t('synthese.figer')}</Button>}<Button as="a" size="sm" variant="ghost" href={`/api/syntheses/editions/${edition.id}/export.xlsx`} download aria-label={t('synthese.exporterExcel')}><Download className="h-4 w-4" aria-hidden="true" /></Button></div>
        </div>
      </Card>)}{!editor.editionsLoading && editor.editions.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('synthese.aucuneEdition')}</p>}</div>
    </div>
  </Drawer>;
}

export function EditionDialog({ edition, blocs, onClose, t, lang, dir }) {
  if (!edition) return null;
  return <Dialog open onClose={onClose} title={`${edition.statut === 'fige' ? t('synthese.editionFigee') : t('synthese.brouillon')} — ${edition.modele_nom}`} size="xl">
    <div className="mb-3 text-xs text-muted">{formatDateShort(edition.periode.debut, lang)} → {formatDateShort(edition.periode.fin, lang)}{edition.statut === 'fige' ? ` · ${t('synthese.immutable')}` : ''}</div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{blocs.map((bloc) => <WidgetCard key={bloc.id} bloc={bloc} result={bloc.resultat} t={t} lang={lang} dir={dir} onVoirFiches={() => {}} />)}</div>
  </Dialog>;
}
