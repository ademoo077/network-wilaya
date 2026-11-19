import { useState, useMemo, useEffect } from 'react';
import { Check, Plus, Star, ChevronDown } from 'lucide-react';
import { Drawer, Input } from '../../components/ui/index.js';
import { MEASURES } from '@anm/shared';

const groups = {
  cohorte: { labelFr: 'Cohorte', labelAr: 'الدفعة' },
  traitement: { labelFr: 'Traitement', labelAr: 'المعالجة' },
  verification: { labelFr: 'Vérification', labelAr: 'التحقق' },
  intervention: { labelFr: 'Intervention', labelAr: 'التدخل' },
  stock: { labelFr: 'Stock', labelAr: 'المخزون' },
  qualite: { labelFr: 'Qualité', labelAr: 'الجودة' },
  derivee: { labelFr: 'Dérivées', labelAr: 'مشتقة' },
};

export default function MeasureLibrary({ open, onClose, selected = [], onSelect, t, lang }) {
  const [query, setQuery] = useState('');
  const [favoris, setFavoris] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('anm-favoris') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });

  const uniqueFavoris = useMemo(() => Array.from(new Set(favoris)).filter(Boolean), [favoris]);

  // V12 : les mesures dépréciées ne sont plus proposées ; elles restent dans le catalogue
  // pour que les éditions figées continuent de s'afficher.
  const disponibles = useMemo(() => MEASURES.filter((m) => !m.deprecated), []);

  useEffect(() => {
    localStorage.setItem('anm-favoris', JSON.stringify(uniqueFavoris));
  }, [uniqueFavoris]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return null;
    return disponibles.filter((m) =>
      m.id.toLowerCase().includes(lower)
      || (lang === 'ar' ? m.label_ar : m.label_fr).toLowerCase().includes(lower));
  }, [disponibles, query, lang]);

  const toggleFavoris = (id) => setFavoris((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const handleSelect = (m) => {
    if (selected.includes(m.id)) return;
    onSelect?.([...selected, m.id]);
    onClose();
  };

  if (!open) return null;

  const renderMesure = (m) => {
    const isSelected = selected.includes(m.id);
    const isFavori = uniqueFavoris.includes(m.id);
    return <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface2 p-3">
      <button type="button" onClick={() => handleSelect(m)} disabled={isSelected}
        className="min-w-0 flex-1 text-start disabled:opacity-60" aria-label={lang === 'ar' ? m.label_ar : m.label_fr}>
        <p className="font-bold text-ink">{lang === 'ar' ? m.label_ar : m.label_fr}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted line-clamp-2">{lang === 'ar' ? m.description_ar : m.description_fr}</p>
        <p className="mt-1 text-[11px] text-ink2">{t('synthese.format')} : <bdi dir="ltr">{m.format}</bdi> • {t('synthese.temporal')} : {m.temporal}</p>
      </button>
      <div className="flex shrink-0 items-start gap-1">
        <button type="button" onClick={() => toggleFavoris(m.id)} className={`rounded-md p-2 ${isFavori ? 'text-gold-500' : 'text-muted hover:text-brand-600'}`} aria-label={lang === 'ar' ? 'مفضلة' : 'Favori'} aria-pressed={isFavori}>
          <Star className={`h-4 w-4 ${isFavori ? 'fill-current' : ''}`} />
        </button>
        <button type="button" onClick={() => handleSelect(m)} disabled={isSelected} className="rounded-md p-2 text-brand-600 disabled:opacity-40" aria-label={lang === 'ar' ? 'إضافة' : 'Ajouter'}>
          {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    </div>;
  };

  return <Drawer open={open} onClose={onClose} title={t('synthese.mesuresBibliotheque')} width="max-w-4xl">
    <div className="grid gap-4">
      <Input placeholder={t('synthese.mesuresSearch')} value={query} onChange={(event) => setQuery(event.target.value)} />

      {uniqueFavoris.length > 0 && !query && <div>
        <h3 className="mb-2 font-bold text-ink">{t('synthese.favoris')}</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {uniqueFavoris.map((id) => disponibles.find((m) => m.id === id)).filter(Boolean).map(renderMesure)}
        </div>
      </div>}

      {filtered ? <div className="grid gap-2">{filtered.length ? filtered.map(renderMesure) : <p className="text-sm text-muted">{t('synthese.mesuresSearchEmpty')}</p>}</div> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(groups).map(([key, meta]) => {
          const count = disponibles.filter((m) => m.temporal === key).length;
          return <button key={key} type="button" onClick={() => setQuery(lang === 'ar' ? meta.labelAr : meta.labelFr)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface2 p-4 text-start transition hover:border-brand-500 hover:bg-brand-50">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-brand-50" aria-hidden="true">{(lang === 'ar' ? meta.labelAr : meta.labelFr).slice(0, 1)}</span>
            <span className="font-bold text-ink">{lang === 'ar' ? meta.labelAr : meta.labelFr}</span>
            <span className="ms-auto text-xs text-muted">{count}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          </button>;
        })}
      </div>}
    </div>
  </Drawer>;
}