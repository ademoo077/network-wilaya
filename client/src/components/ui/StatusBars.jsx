import { STATUTS } from '@anm/shared';
import { useI18n } from '../../i18n/index.jsx';
import { statusColors } from './StatusLegend.jsx';

export default function StatusBars({ row, onStatus }) {
  const { t } = useI18n();
  return <div>
    <div aria-hidden="true" className="my-2 flex h-3 overflow-hidden rounded-full bg-surface2">
      {STATUTS.map((status) => <span key={status} className={statusColors[status]} style={{ width: `${row[`pct_${status}`] || 0}%` }} />)}
    </div>
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {STATUTS.map((status) => <li key={status}>
        <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-sm text-ink2 hover:bg-surface2"
          title={`${t(`status.${status}`)} : ${row[status]} (${row[`pct_${status}`] ?? '—'} %)`}
          onClick={() => onStatus(status)}>
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
          {t(`status.${status}`)} : <strong>{row[status] ?? 0}</strong> · {row[`pct_${status}`] ?? '—'} %
        </button>
      </li>)}
    </ul>
  </div>;
}
