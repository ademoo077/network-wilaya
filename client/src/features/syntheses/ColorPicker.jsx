import { useMemo, useState } from 'react';
import { PALETTES, normaliserCouleur, contrasteRatio } from '@anm/shared';
import { Input, Button } from '../../components/ui/index.js';

const RECENTS_KEY = 'anm:studio:recent-colors';

function readRecents() {
  try { const v = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); return Array.isArray(v) ? v.filter((c) => typeof c === 'string').slice(0, 12) : []; } catch { return []; }
}
function pushRecent(color) {
  const c = normaliserCouleur(color); if (!c) return;
  try {
    const next = [c, ...readRecents().filter((x) => x !== c)].slice(0, 12);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export default function ColorPicker({ value = '', onChange, label, contrastAgainst }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value || '');
  const [tw, setTw] = useState('');
  const recents = useMemo(() => (open ? readRecents() : []), [open]);
  const current = normaliserCouleur(value || hex);
  const ratio = contrastAgainst && current ? contrasteRatio(current, contrastAgainst) : null;

  const apply = (c) => {
    const n = normaliserCouleur(c) || c;
    setHex(n); onChange?.(n); pushRecent(n);
  };

  return <div className="grid gap-1">
    {label && <span className="text-xs font-bold text-ink2">{label}</span>}
    <div className="flex items-center gap-2">
      <button type="button" className="h-8 w-8 rounded border border-border" style={{ backgroundColor: current || 'transparent' }} aria-label={label || 'Couleur'} onClick={() => setOpen((v) => !v)} />
      <Input value={hex} onChange={(e) => { setHex(e.target.value); const n = normaliserCouleur(e.target.value); if (n) onChange?.(n); }} placeholder="RRGGBB" className="flex-1" />
      {current && <Button size="sm" variant="ghost" onClick={() => { setHex(''); onChange?.(''); }}>×</Button>}
    </div>
    {ratio != null && <p className={`text-[11px] ${ratio >= 4.5 ? 'text-muted' : 'text-stcours'}`}>Contraste {ratio.toFixed(2)}:1 {ratio >= 4.5 ? 'AA' : 'sous AA'}</p>}
    {open && <div className="rounded-md border border-border bg-surface p-2 grid gap-2">
      <div className="grid gap-1">
        <p className="text-[11px] font-bold text-muted">Palettes</p>
        {Object.entries(PALETTES).map(([name, colors]) => <div key={name} className="flex items-center gap-1">
          <span className="w-20 shrink-0 text-[11px] text-muted">{name}</span>
          <div className="flex flex-wrap gap-1">{colors.map((c) => <button key={c} type="button" className="h-5 w-5 rounded border border-border" style={{ backgroundColor: c }} aria-label={c} onClick={() => apply(c)} />)}</div>
        </div>)}
      </div>
      <div className="grid gap-1">
        <p className="text-[11px] font-bold text-muted">Récentes</p>
        <div className="flex flex-wrap gap-1">{recents.length ? recents.map((c) => <button key={c} type="button" className="h-5 w-5 rounded border border-border" style={{ backgroundColor: c }} aria-label={c} onClick={() => apply(c)} />) : <span className="text-[11px] text-muted">—</span>}</div>
      </div>
      <div className="flex items-center gap-2">
        <Input value={tw} onChange={(e) => setTw(e.target.value)} placeholder="nom Tailwind (blue-600)" className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => { const c = normaliserCouleur(tw); if (c) apply(c); }}>OK</Button>
      </div>
      <label className="text-[11px] text-muted flex items-center gap-2">Pipette <input type="color" value={/^#[0-9a-f]{6}$/i.test(current) ? current : PALETTES.institutionnel[1]} onChange={(e) => apply(e.target.value)} /></label>
    </div>}
  </div>;
}
