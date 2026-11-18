import { Download, Save } from 'lucide-react';
import { BLOC_TYPES, GALERIE, formatDateShort } from '@anm/shared';
import { Button, Card, Dialog, Drawer, Input, Select, SegmentedControl, Skeleton, Textarea } from '../../components/ui/index.js';
import { Chip } from '../../components/ui/Chip.jsx';
import WidgetCard from './WidgetCard.jsx';

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

export function BlocInspectorDrawer({ open, onClose, bloc, onPatch, typeLabel, t, lang }) {
  return <Drawer open={open} onClose={onClose} title={t('synthese.inspecteur')} width="max-w-lg">
    {bloc && <div className="grid gap-4">
      <Input label={t('synthese.titre')} value={bloc.titre || ''} onChange={(event) => onPatch({ titre: event.target.value })} />
      <Select label={t('synthese.visuel')} value={bloc.type} onChange={(event) => onPatch({ type: event.target.value })} options={BLOC_TYPES.map((type) => ({ value: type, label: typeLabel(type, lang) }))} />
      <div className="grid gap-4 sm:grid-cols-2"><Select label={t('synthese.widget.width')} value={bloc.options?.largeur || 'simple'} onChange={(event) => onPatch({ options: { ...bloc.options, largeur: event.target.value } })} options={[{ value: 'simple', label: t('synthese.widget.widthSimple') }, { value: 'double', label: t('synthese.widget.widthDouble') }, { value: 'pleine', label: t('synthese.widget.widthFull') }]} /><Select label={t('synthese.widget.height')} value={bloc.options?.hauteur || 'normale'} onChange={(event) => onPatch({ options: { ...bloc.options, hauteur: event.target.value } })} options={[{ value: 'compacte', label: t('synthese.widget.heightCompact') }, { value: 'normale', label: t('synthese.widget.heightNormal') }, { value: 'grande', label: t('synthese.widget.heightTall') }]} /></div>
      <Select label={t('synthese.widget.heightMode')} value={bloc.options?.hauteur_mode || 'auto'} onChange={(event) => onPatch({ options: { ...bloc.options, hauteur_mode: event.target.value } })} options={[{ value: 'auto', label: t('synthese.widget.heightAuto') }, { value: 'fixe', label: t('synthese.widget.heightFixed') }]} />
      {bloc.options?.hauteur_mode !== 'fixe' && <div className="grid gap-4 sm:grid-cols-2"><Input type="number" min="1" max="40" label={t('synthese.widget.heightMin')} value={bloc.options?.hauteur_min || 1} onChange={(event) => onPatch({ options: { ...bloc.options, hauteur_min: Number(event.target.value) } })} /><Input type="number" min="1" max="40" label={t('synthese.widget.heightMax')} value={bloc.options?.hauteur_max || 40} onChange={(event) => onPatch({ options: { ...bloc.options, hauteur_max: Number(event.target.value) } })} /></div>}
      <Select label={t('synthese.widget.printVisibility')} value={bloc.options?.masquer_impression ? 'masque' : 'visible'} onChange={(event) => onPatch({ options: { ...bloc.options, masquer_impression: event.target.value === 'masque' } })} options={[{ value: 'visible', label: t('synthese.widget.printVisible') }, { value: 'masque', label: t('synthese.widget.printHidden') }]} />
      {bloc.type === 'texte' && <Textarea label={t('synthese.contenu')} value={bloc.options?.texte_fr || ''} onChange={(event) => onPatch({ options: { ...bloc.options, texte_fr: event.target.value } })} />}
      <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button size="sm" onClick={onClose}>{t('common.appliquer')}</Button></div>
    </div>}
  </Drawer>;
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
