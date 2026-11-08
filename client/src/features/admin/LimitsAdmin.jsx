import { useEffect, useRef, useState } from 'react';
import { MapPinned, Upload } from 'lucide-react';
import L from 'leaflet';
import { api } from '../../api/client.js';
import { Alert, Button, Card, CardHeader, EmptyState, Select, useToast } from '../../components/ui/index.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { refLabel, useI18n } from '../../i18n/index.jsx';

function PreviewMap({ geojson, tileUrl }) {
  const node = useRef(null);
  useEffect(() => {
    if (!node.current || !geojson?.features?.length) return undefined;
    const map = L.map(node.current, { center: [36.7538, 3.0588], zoom: 10, attributionControl: true });
    map.attributionControl.setPrefix(false); map.attributionControl.addAttribution('© OpenStreetMap contributors');
    L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
    const layer = L.geoJSON(geojson, { style: { color: 'var(--brand-700)', weight: 2, fillColor: 'var(--brand-100)', fillOpacity: 0.2 } }).addTo(map);
    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    return () => map.remove();
  }, [geojson, tileUrl]);
  return <div ref={node} className="h-80 overflow-hidden rounded-md border border-border" />;
}

export default function LimitsAdmin() {
  const { t, lang } = useI18n();
  const { refs } = useRefs();
  const { push } = useToast();
  const [file, setFile] = useState(null);
  const [property, setProperty] = useState('');
  const [properties, setProperties] = useState([]);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const send = async (commit = false, selectedProperty = property, selectedFile = file) => {
    if (!selectedFile) return; setLoading(true);
    const body = new FormData(); body.append('file', selectedFile);
    if (selectedProperty) body.append('property', selectedProperty);
    if (Object.keys(mapping).length) body.append('mapping', JSON.stringify(mapping));
    if (commit) body.append('commit', '1');
    try {
      const result = await api(`/admin/limites/import-geojson${commit ? '?commit=1' : ''}`, { method: 'POST', body });
      setProperties(result.item.properties || []); setPreview(result.item);
      if (commit) push(t('common.success'));
    } catch (error) { push(error.message, 'danger'); } finally { setLoading(false); }
  };
  const chooseFile = (selected) => { setFile(selected); setProperty(''); setPreview(null); setMapping({}); if (selected) send(false, '', selected); };
  const communeOptions = refs.dairas.flatMap((daira) => (daira.communes || []).map((commune) => ({ value: commune.id, label: `${refLabel(daira, lang)} › ${refLabel(commune, lang)}` })));
  return <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]"><Card><CardHeader title={t('admin.limits')} /><div className="space-y-4 p-5"><label className="grid min-h-28 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-surface2 p-4 text-center text-sm text-muted"><Upload className="mb-2 h-6 w-6" /><bdi>{file?.name || t('form.dropFiles')}</bdi><input className="sr-only" type="file" accept=".json,.geojson,application/geo+json" onChange={(event) => chooseFile(event.target.files?.[0] || null)} /></label>{properties.length > 0 && <Select label={t('limits.property')} placeholder={t('common.choose')} value={property} options={properties.map((value) => ({ value, label: value }))} onChange={(event) => { setProperty(event.target.value); setMapping({}); send(false, event.target.value); }} />}{preview?.rows?.filter((row) => row.status !== 'matched').map((row) => <Select key={row.index} label={`${t('limits.manual')} · ${row.name || row.index + 1}`} placeholder={t('common.choose')} value={mapping[row.index] || ''} options={communeOptions} onChange={(event) => setMapping((current) => ({ ...current, [row.index]: Number(event.target.value) }))} />)}{Object.keys(mapping).length > 0 && <Button className="w-full" variant="secondary" loading={loading} onClick={() => send(false)}>{t('setup.preview')}</Button>}{preview?.summary?.matched > 0 && <Button className="w-full" loading={loading} onClick={() => send(true)}>{t('limits.commit')}</Button>}</div></Card><Card className="p-4">{preview?.summary && <Alert className="mb-4" variant={preview.summary.errors ? 'warning' : 'success'}>{t('limits.matched', preview.summary)}</Alert>}{preview?.preview?.features?.length ? <PreviewMap geojson={preview.preview} tileUrl={refs.parametres.tile_url} /> : <EmptyState icon={MapPinned} title={t('limits.preview')} compact />}</Card></div>;
}
