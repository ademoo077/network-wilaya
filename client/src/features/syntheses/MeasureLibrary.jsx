import { useState, useMemo } from 'react';
import { Search, X, Plus, Check } from 'lucide-react';
import { Button, Drawer, Input } from '../../components/ui/index.js';
import { CATALOGUE, MEASURES } from '@anm/shared';
import { formatValue } from './widgetData.js';

const groups = {
  cohorte: { labelFr: 'Cohorte', labelAr: 'الدفعة', color: 'brand-600' },
  traitement: { labelFr: 'Traitement', labelAr: 'المعالجة', color: 'amber-600' },
  verification: { labelFr: 'Vérification', labelAr: 'التحقق', color: 'green-600' },
  intervention: { labelFr: 'Intervention', labelAr: 'التدخل', color: 'purple-600' },
  stock: { labelFr: 'Stock', labelAr: 'المخزون', color: 'blue-600' },
  qualite: { labelFr: 'Qualité', labelAr: 'الجودة', color: 'red-600' },
  derivee: { labelFr: 'Dérivées', labelAr: 'مشتقة', color: 'orange-600' },
};

export default function MeasureLibrary({ open, onClose, selected, onSelect, t, lang }) {
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [favoris, setFavoris] = useState(() => {
    const saved = localStorage.getItem('anm-favoris');
    return saved ? JSON.parse(saved) : [];
  });

  const uniqueFavoris = useMemo(() => Array.from(new Set(favoris)).filter(Boolean), [favoris]);

  useEffect(() => {
    localStorage.setItem('anm-favoris', JSON.stringify(uniqueFavoris));
  }, [uniqueFavoris]);

  const filtered = useMemo(() => {
    if (!query) return null;
    const lower = query.toLowerCase();
    return MEASURES.filter((m) =>
      (lang === 'fr' ? m.label_fr.toLowerCase() : m.label_ar.toLowerCase()).includes(lower) ||
      m.id.toLowerCase().includes(lower)
    );
  }, [query, lang]);

  const toggleFavoris = (id) => {
    setFavoris((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleSelect = (m) => {
    if (selected.includes(m.id)) return;
    onSelect([...selected, m.id]);
    onClose();
  };

  if (!open) return null;

  return <Drawer open={open} onClose={onClose} title={t('synthese.mesuresBibliotheque')} width="max-w-4xl">
    <div className="grid gap-4">
      <Input placeholder={t('synthese.mesuresSearch')} value={query} onChange={(e) => setQuery(e.target.value)} />

      {favoris.length > 0 && query === '' && (
        <div>
          <h3 className="font-bold text-ink mb-2">{t('synthese.favoris')}</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {favoris.map((id) => {
              const m = CATALOGUE.mesures[id];
              if (!m) return null;
              const isSelected = selected.includes(id);
              return <button key={id} type="button"
                onClick={() => handleSelect(m)}
                disabled={isSelected}
                className={`flex items-center gap-2 rounded-lg border p-3 text-start transition ${isSelected ? 'bg-brand-100 font-bold text-brand-800' : 'border-border hover:border-brand-400 hover:bg-surface2'}`}>
                {isSelected ? <Check className="h-4 w-4 shrink-0 text-brand-600" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted" />}
                <bdi>{lang === 'ar' ? m.label_ar : m.label_fr}</bdi>
              </button>;
            })}
          </div>
        </div>
      )}

      {query ? (
        <div>
          {filtered.map((m) => {
            const isSelected = selected.includes(m.id);
            return <div key={m.id} className="flex items-start justify-between rounded-lg border border-border bg-surface2 p-3">
              <div className="flex-1">
                <p className="font-bold text-ink">{lang === 'ar' ? m.label_ar : m.label_fr}</p>
                <p className="text-xs text-muted mt-1 line-clamp-2">{lang === 'ar' ? m.description_ar : m.description_fr}</p>
                <p className="text-[11px] text-ink2 mt-1">{t('synthese.format')} : {m.format} • {t('synthese.temporal')} : {m.temporal}</p>
              </div>
              <div className="flex gap-2 ml-4">
                <button type="button" onClick={() => toggleFavoris(m.id)} className="p-2 text-muted hover:text-brand-600" aria-label="Ajouter aux favoris"><ChevronDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => handleSelect(m)} className="p-2 text-brand-600" aria-label="Ajouter"><Plus className="h-4 w-4" /></button>
              </div>
            </div>;
          })}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map(([key, meta]) => (
            <button key={key} type="button" onClick={() => setSelectedGroup(key)}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface2 p-4 text-start transition hover:border-brand-400 hover:bg-brand-50">
              <span className={`h-8 w-8 shrink-0 rounded-full bg-${meta.color} flex items-center justify-center text-white font-bold`}>
                {CATALOGUE.mesures[key] ? CATALOGUE.mesures[key].label_fr.slice(0, 1) : '?'}
              </span>
              <span className="font-bold text-ink">{lang === 'ar' ? meta.labelAr : meta.labelFr}</span>
              <span className="text-xs text-muted ml-auto">{CATALOGUE.mesures[key] ? CATALOGUE.mesures[key].length : 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  </Drawer>;
}