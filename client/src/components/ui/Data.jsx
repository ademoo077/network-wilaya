import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button, IconButton } from './Button.jsx';
import { Checkbox } from './Form.jsx';
import { useI18n } from '../../i18n/index.jsx';

export function DataTable({ columns, rows, rowKey = 'id', sort, dir, onSort, selected = [], onSelect, onRowClick, empty,
  scrollClassName = '', scrollLabel, fixed = false, density = 'comfortable', zebra = false, activeIndex = -1, onRowFocus,
  onResizeColumn }) {
  const { t } = useI18n();
  const selectedSet = new Set(selected.map(String));
  const selectable = Boolean(onSelect);
  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(String(row[rowKey])));
  const toggleAll = () => onSelect(allSelected ? [] : rows.map((row) => row[rowKey]));
  const cellPad = density === 'compact' ? 'py-1.5' : 'py-3';
  return <div tabIndex={0} role={scrollLabel ? 'region' : undefined} aria-label={scrollLabel} className={`max-w-full overflow-auto ${scrollClassName}`}>
    <table className={`w-full border-separate border-spacing-0 text-start text-sm ${fixed ? 'table-fixed' : 'min-w-[760px]'}`}>
      <thead className="sticky top-0 z-10 bg-surface2"><tr>
        {selectable && <th scope="col" className="w-12 border-b border-border px-3 py-2"><Checkbox aria-label="✓" checked={allSelected} onChange={toggleAll} /></th>}
        {columns.map((column) => <th key={column.key} scope="col" style={column.width ? { width: `${column.width}px` } : undefined}
          className={`relative whitespace-nowrap border-b border-border px-3 py-3 text-start text-xs font-bold text-muted ${column.className || ''}`}>
          {column.sortable ? <button className="inline-flex min-h-8 items-center gap-1" onClick={() => onSort?.(column.key)}>{column.label}{sort === column.key ? dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />}</button> : column.label}
          {onResizeColumn && <span role="separator" aria-orientation="vertical" aria-label={`${t('synthese.redimensionner')} ${column.label}`}
            data-resize-handle={column.key} className="absolute end-0 top-0 h-full w-2 cursor-col-resize touch-none"
            onPointerDown={(event) => onResizeColumn(event, column.key)} />}
        </th>)}
      </tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row[rowKey]} data-row-index={index} tabIndex={0}
        className={`${onRowClick ? 'cursor-pointer' : ''} ${zebra && index % 2 ? 'bg-surface2' : ''} ${activeIndex === index ? 'bg-brand-100' : ''} hover:bg-brand-100`.trim()}
        onClick={() => onRowClick?.(row)} onFocus={() => onRowFocus?.(row, index)}>
        {selectable && <td className={`border-b border-border px-3 ${cellPad}`} onClick={(event) => event.stopPropagation()}>
          <Checkbox aria-label={String(row[rowKey])} checked={selectedSet.has(String(row[rowKey]))}
            onChange={() => onSelect(selectedSet.has(String(row[rowKey])) ? selected.filter((id) => String(id) !== String(row[rowKey])) : [...selected, row[rowKey]])} />
        </td>}
        {columns.map((column) => <td key={column.key} className={`border-b border-border px-3 ${cellPad} align-middle text-ink ${column.cellClassName || ''}`}>
          {column.render ? column.render(row) : row[column.key] ?? '—'}
        </td>)}
      </tr>)}</tbody>
    </table>{!rows.length && empty}
  </div>;
}

function pageNumbers(page, totalPages) {
  const values = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...values].filter((value) => value > 0 && value <= totalPages).sort((a, b) => a - b);
}

export function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const numbers = pageNumbers(page, pages);
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  return <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3" aria-label={t('common.page')}><p className="text-xs text-muted">{t('common.display', { from, to, total })}</p><div className="flex flex-wrap items-center gap-1"><Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('common.previous')}</Button>{numbers.map((number, index) => <span key={number} className="inline-flex items-center gap-1">{index > 0 && numbers[index - 1] !== number - 1 && <span className="px-1 text-muted">…</span>}<IconButton className={`h-9 w-9 ${number === page ? 'bg-brand-100 text-brand-800' : ''}`} aria-current={number === page ? 'page' : undefined} aria-label={`${t('common.page')} ${number}`} onClick={() => onPage(number)}>{number}</IconButton></span>)}<Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t('common.next')}</Button><select aria-label={t('common.pageSize')} className="ms-2 h-9 rounded-sm border border-border bg-surface px-2 text-xs" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>{[10, 25, 50, 100, 200].map((size) => <option key={size}>{size}</option>)}</select></div></nav>;
}
