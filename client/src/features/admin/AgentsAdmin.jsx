import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Upload, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useToast } from '../../components/ui/index.js';
import { api } from '../../api/client.js';

/** Écran admin « Affectation des agents » : 14 daïras, titulaire/suppléant, charge, import CSV. */
export default function AgentsAdmin() {
  const { t } = useI18n();
  const { push } = useToast();
  const [items, setItems] = useState([]);
  const [coverage, setCoverage] = useState('');
  const [loading, setLoading] = useState(true);
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillPreview, setBackfillPreview] = useState(null);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/admin/affectations');
      setItems(res.item || res.items || []);
      setCoverage(res.coverage || '');
    } catch (e) {
      push(e.message || 'Erreur chargement affectations', 'danger');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { load(); }, [load]);

  const doImport = useCallback(async () => {
    if (!csv.trim()) return;
    setImporting(true);
    try {
      const res = await api('/admin/affectations/import', { method: 'POST', body: { csv } });
      push(t('admin.affectations.imported', { created: res.item.created, updated: res.item.updated, errors: res.item.errors.length }), res.item.errors.length ? 'warning' : 'success');
      setCsv(''); setImportPreview(null);
      await load();
    } catch (e) {
      push(e.message || 'Erreur import', 'danger');
    } finally {
      setImporting(false);
    }
  }, [csv, load, push, t]);

  const previewImport = useCallback(() => {
    const lines = csv.trim().split('\n').filter(Boolean);
    const rows = lines.slice(1).map((l) => {
      const [daira, nom, matricule, role] = l.split(';').map((s) => s.trim());
      return { daira, nom, matricule, role: role || 'titulaire' };
    });
    setImportPreview(rows);
  }, [csv]);

  const doBackfill = useCallback(async () => {
    setBackfillBusy(true);
    try {
      const res = await api('/admin/affectations/backfill', { method: 'POST', body: { include_traitees: false } });
      push(t('admin.affectations.backfilled', { affected: res.item.affected, total: res.item.total }), res.item.errors.length ? 'warning' : 'success');
      setBackfillOpen(false); setBackfillPreview(null);
      await load();
    } catch (e) {
      push(e.message || 'Erreur backfill', 'danger');
    } finally {
      setBackfillBusy(false);
    }
  }, [load, push, t]);

  const previewBackfill = useCallback(async () => {
    try {
      const res = await api('/admin/affectations/backfill-preview', { method: 'POST', body: { include_traitees: false } });
      setBackfillPreview(res.item);
    } catch (e) {
      push(e.message || 'Erreur aperçu', 'danger');
    }
  }, [push]);

  if (loading) return <p className="text-sm text-muted">{t('common.loading')}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-700" aria-hidden="true" />
          <span className="text-sm font-bold">{t('admin.affectations.coverage')} : {coverage}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />{t('common.refresh')}
          </button>
          <button type="button" onClick={() => setBackfillOpen(true)} className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface2">
            {t('admin.affectations.backfill')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface2 text-left">
            <tr>
              <th className="px-3 py-2 font-bold">{t('field.daira')}</th>
              <th className="px-3 py-2 font-bold">{t('admin.affectations.titulaire')}</th>
              <th className="px-3 py-2 font-bold">{t('admin.affectations.suppleant')}</th>
              <th className="px-3 py-2 font-bold">{t('admin.affectations.statut')}</th>
              <th className="px-3 py-2 text-right font-bold">{t('admin.affectations.charge')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.daira.id} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">{row.daira.name_fr}</td>
                <td className="px-3 py-2">{row.titulaire ? `${row.titulaire.full_name} (${row.titulaire.matricule || '—'})` : '—'}</td>
                <td className="px-3 py-2">{row.suppleant ? `${row.suppleant.full_name} (${row.suppleant.matricule || '—'})` : '—'}</td>
                <td className="px-3 py-2">
                  {row.complet
                    ? <span className="inline-flex items-center gap-1 rounded-sm bg-successbg px-2 py-0.5 text-xs font-semibold text-success"><CheckCircle className="h-3 w-3" aria-hidden="true" />{t('admin.affectations.complet')}</span>
                    : <span className="inline-flex items-center gap-1 rounded-sm bg-warningbg px-2 py-0.5 text-xs font-semibold text-warning"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{t('admin.affectations.manquant')}</span>}
                </td>
                <td className="px-3 py-2 text-right">{row.stats.non_traite + row.stats.en_cours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-sm border border-border bg-surface2 p-3">
        <p className="text-xs font-semibold text-muted">{t('admin.affectations.importTitle')}</p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          className="mt-2 w-full rounded-sm border border-border bg-surface p-2 text-sm text-ink"
          placeholder="daira;nom_agent;matricule;role"
          aria-label={t('admin.affectations.importTitle')}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={previewImport} className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface2">
            {t('admin.affectations.preview')}
          </button>
          <button type="button" onClick={doImport} disabled={importing || !csv.trim()} className="inline-flex min-h-11 items-center gap-1 rounded-sm bg-brand-700 px-3 text-sm font-semibold text-brand-50 hover:bg-brand-800 disabled:opacity-50">
            <Upload className="h-4 w-4" aria-hidden="true" />{importing ? t('common.loading') : t('admin.affectations.import')}
          </button>
        </div>
        {importPreview && (
          <div className="mt-3 overflow-x-auto rounded-sm border border-border">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-surface2 text-left">
                <tr><th className="px-2 py-1 font-bold">{t('field.daira')}</th><th className="px-2 py-1 font-bold">{t('admin.affectations.agent')}</th><th className="px-2 py-1 font-bold">{t('admin.affectations.role')}</th></tr>
              </thead>
              <tbody>
                {importPreview.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1">{r.daira}</td>
                    <td className="px-2 py-1">{r.nom} ({r.matricule})</td>
                    <td className="px-2 py-1">{r.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {backfillOpen && (
        <div className="rounded-sm border border-border bg-surface2 p-3">
          <p className="text-sm font-bold">{t('admin.affectations.backfillTitle')}</p>
          <p className="mt-1 text-xs text-muted">{t('admin.affectations.backfillHelp')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={previewBackfill} className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface2">
              {t('admin.affectations.preview')}
            </button>
            <button type="button" onClick={doBackfill} disabled={backfillBusy} className="inline-flex min-h-11 items-center gap-1 rounded-sm bg-brand-700 px-3 text-sm font-semibold text-brand-50 hover:bg-brand-800 disabled:opacity-50">
              {backfillBusy ? t('common.loading') : t('admin.affectations.confirm')}
            </button>
            <button type="button" onClick={() => { setBackfillOpen(false); setBackfillPreview(null); }} className="inline-flex min-h-11 items-center rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface2">
              {t('common.cancel')}
            </button>
          </div>
          {backfillPreview && (
            <p className="mt-2 text-sm">{t('admin.affectations.backfillPreview', { count: backfillPreview.total })}</p>
          )}
        </div>
      )}
    </div>
  );
}